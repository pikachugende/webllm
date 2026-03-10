/**
 * useWebLLM.ts
 *
 * Custom hook that:
 *  – Spawns the WebLLM Web Worker (engine.worker.ts)
 *  – Tracks model load progress (0 → 100 %)
 *  – Exposes `modelCached` once weights are stored in IndexedDB
 *  – Manages multi-conversation state persisted to localStorage
 *  – Streams AI responses word-by-word via onmessage events
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { hasModelInCache } from '@mlc-ai/web-llm';
import type {
  Message,
  MessageAttachment,
  ImageAttachment,
  Conversation,
  ToWorker,
  FromWorker,
  WorkerChatMessage,
  ContentPart,
  EngineMode,
} from '../types';
import { VISION_MODELS, INSTANT_MODEL, REASONING_MODEL } from '../types';
import { classify } from '../classifier/router';

// ── Public surface ────────────────────────────────────────────────────────────

export type EngineStatus =
  | 'loading'     // initial model download / compile
  | 'switching'   // hot-swapping to a different model
  | 'ready'       // idle, waiting for user input
  | 'generating'  // streaming a response
  | 'error';      // unrecoverable failure

export interface UseWebLLMReturn {
  status: EngineStatus;
  /** Download/compile progress 0-100 */
  progress: number;
  progressText: string;
  /** True once model weights are fully stored in IndexedDB */
  modelCached: boolean;
  /** True when the active model supports image inputs */
  isVisionModel: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  currentMessages: Message[];
  sendMessage: (text: string, attachments?: MessageAttachment[]) => void;
  editMessage: (id: string, newText: string) => void;
  stopGeneration: () => void;
  startNewChat: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  regenerateResponse: () => void;
  renameConversation: (id: string, title: string) => void;
  error: string | null;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  /** Current routing mode selected by the user */
  mode: EngineMode;
  setMode: (mode: EngineMode) => void;
  /** Which model was used for the last generation (useful in auto mode) */
  lastRouteDecision: 'instant' | 'reasoning' | null;
  /** The model ID currently loaded in the worker */
  activeModel: string;
  /** Whether the reasoning model weights are cached in IndexedDB */
  reasoningCached: boolean;
  /** Background download progress for the reasoning model (0-100), null = not downloading */
  preloadProgress: number | null;
  preloadText: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Gemma 2B – instruction-tuned, 4-bit quantised (q4f32).
 * This is the smallest Gemma model available in @mlc-ai/web-llm 0.2.79.
 *
 * Other available Gemma IDs in this version:
 *   gemma-2b-it-q4f16_1-MLC        (2B, smaller memory footprint)
 *   gemma-2-2b-it-q4f32_1-MLC      (Gemma 2, 2B)
 *   gemma-2-2b-it-q4f16_1-MLC      (Gemma 2, 2B, smaller)
 *   gemma-2-9b-it-q4f32_1-MLC      (Gemma 2, 9B – needs strong GPU)
 *
 * To get Gemma 3 models, upgrade the package:
 *   npm install @mlc-ai/web-llm@latest
 * Then check the new IDs with:
 *   grep -o '"gemma[^"]*"' node_modules/@mlc-ai/web-llm/lib/index.js | sort -u
 */
export const DEFAULT_MODEL = INSTANT_MODEL;

const LS_KEY = 'webllm_conversations';
const LS_PROMPT_KEY = 'webllm_system_prompt';
const LS_MODE_KEY = 'webllm_mode';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, accurate, and concise AI assistant. Answer the user's questions directly and honestly.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function readConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function writeConversations(convs: Conversation[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(convs));
}

function titleFromContent(content: string): string {
  // Take the first 6 words of the message for an instant, reliable title
  const words = content.trim().replace(/\s+/g, ' ').split(' ');
  const title = words.slice(0, 6).join(' ');
  return words.length > 6 ? title + '…' : title;
}

/** Build the full text sent to the LLM, combining user text with file attachments. */
function buildLLMContent(msg: Message): string | ContentPart[] {
  // Text-only path (existing behaviour)
  if (!msg.attachments?.length) return msg.content;
  const files = msg.attachments
    .map(a => `[Attached file: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``)
    .join('\n\n');
  return msg.content ? `${msg.content}\n\n${files}` : files;
}

// routeMessage replaced by trained classifier — see src/classifier/router.ts

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWebLLM(model: string = DEFAULT_MODEL): UseWebLLMReturn {
  // ─ Worker ─
  const workerRef = useRef<Worker | null>(null);

  // ─ Engine state ─
  const [status, setStatus] = useState<EngineStatus>('loading');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Initialising WebLLM…');
  const [modelCached, setModelCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─ Conversation state ─
  const [conversations, setConversations] = useState<Conversation[]>(readConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);

  // ─ System prompt ─
  const [systemPrompt, setSystemPromptState] = useState<string>(
    () => localStorage.getItem(LS_PROMPT_KEY) ?? DEFAULT_SYSTEM_PROMPT,
  );
  const systemPromptRef = useRef(systemPrompt);
  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);

  const setSystemPrompt = useCallback((prompt: string) => {
    const p = prompt.trim() || DEFAULT_SYSTEM_PROMPT;
    localStorage.setItem(LS_PROMPT_KEY, p);
    setSystemPromptState(p);
  }, []);

  // ─ Mode & routing ─
  const [mode, setModeState] = useState<EngineMode>(
    () => (localStorage.getItem(LS_MODE_KEY) as EngineMode | null) ?? 'instant',
  );
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const setMode = useCallback((m: EngineMode) => {
    localStorage.setItem(LS_MODE_KEY, m);
    setModeState(m);
  }, []);

  const [lastRouteDecision, setLastRouteDecision] = useState<'instant' | 'reasoning' | null>(null);
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_MODEL);

  // Tracks the model ID that is currently loaded in the worker.
  const loadedModelRef = useRef<string>(DEFAULT_MODEL);
  // Stores a generate payload to send after a reload completes.
  const pendingGenerateRef = useRef<ToWorker | null>(null);

  // ─ Reasoning model pre-download state ─
  const [reasoningCached, setReasoningCached] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<number | null>(null);
  const [preloadText, setPreloadText] = useState('');
  const preloadStartedRef = useRef(false);

  // ─ Refs to avoid stale closures inside the worker message handler ─
  const pendingIdRef = useRef<string | null>(null);
  const currentMessagesRef = useRef<Message[]>([]);
  const activeConvIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { currentMessagesRef.current = currentMessages; }, [currentMessages]);
  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);

  // ─ Check cache state of both models on first mount ───────────────────────
  useEffect(() => {
    hasModelInCache(REASONING_MODEL)
      .then(cached => setReasoningCached(cached))
      .catch(() => {});
  }, []);

  // Persist conversations to localStorage on every change
  useEffect(() => { writeConversations(conversations); }, [conversations]);

  // ─ Worker initialisation ─────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../engine.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'progress': {
          setProgress(msg.progress);
          setProgressText(msg.text);
          break;
        }

        case 'ready': {
          setProgress(100);
          setProgressText('Model ready');
          setModelCached(true); // weights are now in IndexedDB
          // Dispatch a queued generate (happens after a model hot-swap)
          if (pendingGenerateRef.current && workerRef.current) {
            const pending = pendingGenerateRef.current;
            pendingGenerateRef.current = null;
            workerRef.current.postMessage(pending);
            setStatus('generating');
          } else {
            setStatus('ready');
            // After the instant model is ready, pre-download the reasoning model
            // in the background if it isn’t already cached.
            if (!preloadStartedRef.current && workerRef.current) {
              preloadStartedRef.current = true;
              hasModelInCache(REASONING_MODEL).then(cached => {
                if (cached) {
                  setReasoningCached(true);
                } else {
                  workerRef.current!.postMessage(
                    { type: 'preload', model: REASONING_MODEL } satisfies ToWorker,
                  );
                  setPreloadProgress(0);
                }
              }).catch(() => {});
            }
          }
          break;
        }

        case 'chunk': {
          if (msg.id !== pendingIdRef.current) break;
          // Append the streaming delta to the current assistant message
          setCurrentMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === msg.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], content: updated[idx].content + msg.delta };
            }
            return updated;
          });
          break;
        }

        case 'done': {
          setStatus('ready');
          pendingIdRef.current = null;

          // Persist the now-complete conversation to localStorage
          const convId = activeConvIdRef.current;
          const messages = currentMessagesRef.current;

          setConversations(prev => {
            const existing = prev.find(c => c.id === convId);
            if (existing) {
              return prev.map(c =>
                c.id === convId ? { ...c, messages, updatedAt: Date.now() } : c,
              );
            } else if (convId) {
              const firstUserContent = messages.find(m => m.role === 'user')?.content ?? 'New Chat';
              const fresh: Conversation = {
                id: convId,
                title: titleFromContent(firstUserContent),
                messages,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              return [fresh, ...prev];
            }
            return prev;
          });
          break;
        }

        case 'error': {
          setError(msg.message);
          setStatus('error');
          break;
        }

        case 'preload_progress': {
          setPreloadProgress(msg.progress);
          setPreloadText(msg.text);
          break;
        }

        case 'preload_done': {
          setPreloadProgress(null);
          setPreloadText('');
          setReasoningCached(true);
          break;
        }
      }
    };

    worker.onerror = (err) => {
      setError(err.message ?? 'Unknown worker error');
      setStatus('error');
    };

    // Kick off model loading
    const initMsg: ToWorker = { type: 'init', model };
    worker.postMessage(initMsg);

    return () => {
      worker.terminate();
    };
  }, [model]);

  // ─ Public API ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (text: string, attachments?: MessageAttachment[]) => {
      if (status !== 'ready' || !workerRef.current) return;

      const trimmed = text.trim();
      if (!trimmed && !attachments?.length) return;

      // Ensure an active conversation exists
      let convId = activeConvIdRef.current;
      if (!convId) {
        convId = uuidv4();
        activeConvIdRef.current = convId; // update ref immediately
        setActiveConversationId(convId);
      }

      const userMsg: Message = {
        id: uuidv4(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
        attachments: attachments?.length ? attachments : undefined,
      };

      const assistantId = uuidv4();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      const nextMessages = [...currentMessagesRef.current, userMsg, assistantMsg];
      setCurrentMessages(nextMessages);
      pendingIdRef.current = assistantId;

      // Build full context for the model (exclude the empty assistant stub)
      const history: WorkerChatMessage[] = nextMessages
        .filter(m => m.id !== assistantId)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: buildLLMContent(m) }));

      const generateMsg: ToWorker = {
        type: 'generate',
        id: assistantId,
        messages: [{ role: 'system', content: systemPromptRef.current }, ...history],
      };

      // ─ Model routing ─────────────────────────────────────────────
      const route: 'instant' | 'reasoning' =
        modeRef.current === 'instant'   ? 'instant'
        : modeRef.current === 'reasoning' ? 'reasoning'
        : classify(trimmed);

      const targetModel = route === 'reasoning' ? REASONING_MODEL : INSTANT_MODEL;
      setLastRouteDecision(route);
      setActiveModel(targetModel);

      if (targetModel !== loadedModelRef.current) {
        // Hot-swap to the needed model, then dispatch generate from the ready handler
        loadedModelRef.current = targetModel;
        pendingGenerateRef.current = generateMsg;
        setStatus('switching');
        workerRef.current.postMessage({ type: 'reload', model: targetModel } satisfies ToWorker);
      } else {
        setStatus('generating');
        workerRef.current.postMessage(generateMsg);
      }
    },
    [status],
  );

  const editMessage = useCallback((id: string, newText: string) => {
    if (status !== 'ready' || !workerRef.current) return;
    const trimmed = newText.trim();
    if (!trimmed) return;

    const messages = currentMessagesRef.current;
    const idx = messages.findIndex(m => m.id === id);
    if (idx === -1) return;

    // Truncate everything after the edited user message
    const updatedUserMsg = { ...messages[idx], content: trimmed };
    
    const assistantId = uuidv4();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const nextMessages = [...messages.slice(0, idx), updatedUserMsg, assistantMsg];
    setCurrentMessages(nextMessages);
    pendingIdRef.current = assistantId;

    const history: WorkerChatMessage[] = nextMessages
      .filter(m => m.id !== assistantId)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: buildLLMContent(m) }));

    const generateMsg: ToWorker = {
      type: 'generate',
      id: assistantId,
      messages: [{ role: 'system', content: systemPromptRef.current }, ...history],
    };

    // Routing
    const route: 'instant' | 'reasoning' =
      modeRef.current === 'instant'   ? 'instant'
      : modeRef.current === 'reasoning' ? 'reasoning'
      : classify(trimmed);

    const targetModel = route === 'reasoning' ? REASONING_MODEL : INSTANT_MODEL;
    setLastRouteDecision(route);
    setActiveModel(targetModel);

    if (targetModel !== loadedModelRef.current) {
      loadedModelRef.current = targetModel;
      pendingGenerateRef.current = generateMsg;
      setStatus('switching');
      workerRef.current.postMessage({ type: 'reload', model: targetModel } satisfies ToWorker);
    } else {
      setStatus('generating');
      workerRef.current.postMessage(generateMsg);
    }
  }, [status]);

  const stopGeneration = useCallback(() => {
    const msg: ToWorker = { type: 'abort' };
    workerRef.current?.postMessage(msg);
    setStatus('ready');
    pendingIdRef.current = null;
  }, []);

  const startNewChat = useCallback(() => {
    activeConvIdRef.current = null;
    setActiveConversationId(null);
    setCurrentMessages([]);
    pendingIdRef.current = null;
  }, []);

  const loadConversation = useCallback(
    (id: string) => {
      const conv = conversations.find(c => c.id === id);
      if (!conv) return;
      activeConvIdRef.current = id;
      setActiveConversationId(id);
      setCurrentMessages(conv.messages);
    },
    [conversations],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConvIdRef.current === id) {
        activeConvIdRef.current = null;
        setActiveConversationId(null);
        setCurrentMessages([]);
      }
    },
    [],
  );

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title: title.trim() || c.title } : c),
    );
  }, []);

  const regenerateResponse = useCallback(() => {
    if (status !== 'ready' || !workerRef.current) return;

    const messages = currentMessagesRef.current;
    // Find the last user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;

    const assistantId = uuidv4();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    // Keep all messages up to and including the last user message, then append new stub
    const nextMessages = [...messages.slice(0, lastUserIdx + 1), assistantMsg];
    setCurrentMessages(nextMessages);
    pendingIdRef.current = assistantId;
    setStatus('generating');

    const history: WorkerChatMessage[] = nextMessages
      .filter(m => m.id !== assistantId)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: buildLLMContent(m) }));

    workerRef.current.postMessage({
      type: 'generate',
      id: assistantId,
      messages: [{ role: 'system', content: systemPromptRef.current }, ...history],
    } satisfies ToWorker);
  }, [status]);

  return {
    status,
    progress,
    progressText,
    modelCached,
    isVisionModel: VISION_MODELS.includes(activeModel),
    conversations,
    activeConversationId,
    currentMessages,
    sendMessage,
    editMessage,
    stopGeneration,
    startNewChat,
    loadConversation,
    deleteConversation,
    regenerateResponse,
    renameConversation,
    error,
    systemPrompt,
    setSystemPrompt,
    mode,
    setMode,
    lastRouteDecision,
    activeModel,
    reasoningCached,
    preloadProgress,
    preloadText,
  };
}
