import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, RefreshCw, Paperclip, ChevronDown, Brain, Pencil } from 'lucide-react';
import type { Message } from '../types';

// ── Code block with copy button ───────────────────────────────────────────────

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function CodeBlock({ inline, className, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  if (inline) {
    return (
      <code className={className}>
        {children}
      </code>
    );
  }

  const code = String(children ?? '').replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group/code">
      <pre className={className}>
        <code>{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 flex items-center gap-1 text-[11px]
                   bg-[#2a2a2a] border border-[#444] text-[#8e8ea0]
                   hover:text-[#ececec] hover:border-[#666]
                   px-2 py-1 rounded-md transition-colors
                   opacity-0 group-hover/code:opacity-100"
        aria-label="Copy code"
      >
        {copied
          ? <><Check size={11} className="text-emerald-400" /><span className="text-emerald-400">Copied</span></>
          : <><Copy size={11} /><span>Copy</span></>
        }
      </button>
    </div>
  );
}

// ── Think block ───────────────────────────────────────────────────────────────

function parseThinking(content: string): {
  thinking: string | null;
  response: string;
  isThinking: boolean;
} {
  // Complete <think>...</think> block
  const match = content.match(/^<think>([\s\S]*?)<\/think>\s*/);
  if (match) {
    return { thinking: match[1].trim(), response: content.slice(match[0].length), isThinking: false };
  }
  // Still streaming inside <think> (no closing tag yet)
  if (content.startsWith('<think>')) {
    return { thinking: content.slice(7), response: '', isThinking: true };
  }
  return { thinking: null, response: content, isThinking: false };
}

interface ThinkBlockProps {
  thinking: string;
  isThinking: boolean;
}

function ThinkBlock({ thinking, isThinking }: ThinkBlockProps) {
  const [open, setOpen] = useState(true);

  // Auto-collapse once the model finishes thinking
  useEffect(() => {
    if (!isThinking) setOpen(false);
  }, [isThinking]);

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-[#8b5cf6] hover:text-[#a78bfa] transition-colors"
        aria-expanded={open}
      >
        <Brain size={13} className={isThinking ? 'animate-pulse' : ''} />
        <span className="font-medium">
          {isThinking ? 'Thinking…' : 'Thought for a moment'}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="mt-2 pl-3 border-l-2 border-violet-900/60
                     text-[#7a7a90] text-xs leading-relaxed
                     whitespace-pre-wrap break-words
                     max-h-56 overflow-y-auto"
        >
          {thinking || <span className="italic opacity-50">…</span>}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface UserBubbleProps {
  content: string;
  attachments?: Message['attachments'];
  onEdit?: (newContent: string) => void;
}

function UserBubble({ content, attachments, onEdit }: UserBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleSave = () => {
    if (onEdit && editContent.trim() !== content) {
      onEdit(editContent);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-start justify-end gap-3 w-full group/user">
      {/* Message bubble */}
      <div className="max-w-[85%] md:max-w-[75%] space-y-2 relative">
        {/* Edit Button */}
        {!isEditing && onEdit && (
          <button
            onClick={() => {
              setEditContent(content);
              setIsEditing(true);
            }}
            className="absolute -left-9 top-2 p-1.5 rounded-full text-[#6e6e80] bg-[#2a2a2a] border border-[#444]
                       hover:text-[#ececec] hover:bg-[#3a3a3a] opacity-0 group-hover/user:opacity-100 transition-all"
            aria-label="Edit message"
          >
            <Pencil size={12} />
          </button>
        )}

        {/* File attachment chips */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {attachments.map(a => (
              <span
                key={a.name}
                className="flex items-center gap-1.5 bg-[#3a3a3a] text-[#adadbe]
                           text-xs px-2.5 py-1 rounded-2xl border border-[#4a4a4a]"
              >
                <Paperclip size={11} className="shrink-0" />
                <span className="max-w-[140px] truncate">{a.name}</span>
              </span>
            ))}
          </div>
        )}

        {isEditing ? (
          <div className="bg-[#2f2f2f] px-4 py-3 rounded-3xl min-w-[250px]">
            <textarea
              autoFocus
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full bg-transparent text-[#ececec] outline-none text-[15px] resize-none min-h-[60px]"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#3a3a3a] text-[#ececec] hover:bg-[#444]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#ececec] text-[#212121] hover:bg-white"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          content && (
            <div
              className="bg-[#2f2f2f] text-[#ececec]
                         px-5 py-2.5 rounded-3xl text-[15px] leading-relaxed
                         whitespace-pre-wrap break-words"
            >
              {content}
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface AssistantBubbleProps {
  content: string;
  isStreaming: boolean;
  isLastAssistant: boolean;
  onCopy: () => void;
  copied: boolean;
  onRegenerate?: () => void;
}

function AssistantBubble({
  content,
  isStreaming,
  isLastAssistant,
  onCopy,
  copied,
  onRegenerate,
}: AssistantBubbleProps) {
  return (
    <div className="flex items-start gap-4 group md:pr-4">
      {/* Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center mt-1">
        <Bot size={18} className="text-[#212121]" />
      </div>

      {/* Content */}
      <div className="flex-1 pt-1 min-w-0">
        {(() => {
          const { thinking, response, isThinking } = parseThinking(content);
          return (
            <>
              {thinking !== null && (
                <ThinkBlock thinking={thinking} isThinking={isThinking} />
              )}
              {response ? (
                <div
                  className="prose prose-invert max-w-none text-[15px]
                             prose-p:leading-relaxed prose-p:my-1.5
                             prose-headings:text-[#ececec]
                             prose-strong:text-[#ececec]
                             prose-code:text-emerald-300 prose-code:bg-[#1e1e1e]
                             prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                             prose-code:text-[0.8em] prose-code:before:content-none
                             prose-code:after:content-none
                             prose-pre:bg-[#0d0d0d] prose-pre:border prose-pre:border-[#333]
                             prose-pre:rounded-xl prose-pre:text-sm prose-pre:p-4
                             prose-a:text-blue-400 hover:prose-a:underline prose-a:no-underline
                             prose-blockquote:border-l-emerald-500 prose-blockquote:text-[#adadbe]
                             prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ code: CodeBlock as React.ComponentType<React.ClassAttributes<HTMLElement> & React.HTMLAttributes<HTMLElement> & { inline?: boolean }> }}
                  >{response}</ReactMarkdown>
                </div>
              ) : null}
            </>
          );
        })()}

        {/* Streaming cursor / ellipsis */}
        {isStreaming && (
          content
            ? <span className="typing-cursor" />
            : (
              <span className="flex gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-[#6e6e80] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[#6e6e80] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#6e6e80] animate-bounce" />
              </span>
            )
        )}

        {/* Action row – shown when not streaming */}
        {!isStreaming && content && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 text-[11px] text-[#6e6e80] hover:text-[#ececec]
                         px-2 py-1 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              aria-label="Copy message"
            >
              {copied
                ? <><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                : <><Copy size={12} /><span>Copy</span></>
              }
            </button>

            {isLastAssistant && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 text-[11px] text-[#6e6e80] hover:text-[#ececec]
                           px-2 py-1 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                aria-label="Regenerate response"
              >
                <RefreshCw size={12} />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ChatContainerProps {
  messages: Message[];
  isGenerating: boolean;
  onRegenerate: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
}

export function ChatContainer({ messages, isGenerating, onRegenerate, onEditMessage }: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll to bottom whenever a message is added or the last message grows
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show/hide the scroll-to-bottom button based on scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distanceFromBottom > 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleCopy = (id: string, content: string) => {
    const clean = content.replace(/^<think>[\s\S]*?<\/think>\s*/, '');
    navigator.clipboard.writeText(clean).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Find the last assistant message index (for the regenerate button)
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') { lastAssistantIdx = i; break; }
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.map((msg, idx) => {
            const streaming = isGenerating && msg.role === 'assistant' && idx === messages.length - 1;

            if (msg.role === 'user') {
              return (
                <UserBubble
                  key={msg.id}
                  content={msg.content}
                  attachments={msg.attachments}
                  onEdit={(newContent) => onEditMessage?.(msg.id, newContent)}
                />
              );
            }

            // Filter out system messages from the UI
            if (msg.role === 'system') return null;

            return (
              <AssistantBubble
                key={msg.id}
                content={msg.content}
                isStreaming={streaming}
                isLastAssistant={idx === lastAssistantIdx}
                onCopy={() => handleCopy(msg.id, msg.content)}
                copied={copiedId === msg.id}
                onRegenerate={!isGenerating ? onRegenerate : undefined}
              />
            );
          })}

          {/* Invisible anchor for auto-scroll */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom floating button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2
                     flex items-center gap-1.5 text-xs text-[#ececec]
                     bg-[#3a3a3a] border border-[#555] px-3 py-1.5 rounded-full
                     shadow-lg hover:bg-[#444] transition-colors"
          aria-label="Scroll to bottom"
        >
          <ChevronDown size={14} />
          <span>Scroll to bottom</span>
        </button>
      )}
    </div>
  );
}

