// ── Shared data types ────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export type ThinkingMode = 'instant' | 'thinking' | 'auto';

export interface MessageAttachment {
  /** Original file name */
  name: string;
  /** Text content of the file (may be truncated to 8 000 chars) */
  content: string;
}

export interface ImageAttachment {
  /** Original file name */
  name: string;
  /** data:<mime>;base64,<data> – ready to pass to image_url.url */
  dataUrl: string;
  /** MIME type, e.g. "image/png" */
  mimeType: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachments?: MessageAttachment[];
}

export interface Conversation {
  id: string;
  /** First user message, truncated to ~45 chars */
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ── Worker message protocol ──────────────────────────────────────────────────

/** Content part for text (all models) */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/** Content part for images (vision models only) */
export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string };
}

export type ContentPart = TextContentPart | ImageContentPart;

/** Minimal subset of ChatCompletionMessageParam we need. */
export interface WorkerChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export type ToWorker =
  | { type: 'init'; model: string; appConfig?: Record<string, unknown> }
  | { type: 'generate'; id: string; messages: WorkerChatMessage[]; enableThinking?: boolean | null }
  | { type: 'abort' };

export type FromWorker =
  | { type: 'progress'; progress: number; text: string }
  | { type: 'ready'; cached: boolean }
  | { type: 'chunk'; id: string; delta: string }
  | { type: 'done'; id: string }
  | { type: 'error'; message: string };

// ── Vision model list ─────────────────────────────────────────────────────────

/** Models in @mlc-ai/web-llm that accept image content parts. */
export const VISION_MODELS: readonly string[] = [
  'Phi-3.5-vision-instruct-q4f16_1-MLC',
  'Phi-3.5-vision-instruct-q4f32_1-MLC',
];

// ── Gemma 4 model IDs ────────────────────────────────────────────────────────

export const GEMMA4_E2B_MODEL_ID = 'gemma-4-E2B-it-q4f16_1-MLC';
export const GEMMA4_E4B_MODEL_ID = 'gemma-4-E4B-it-q4f16_1-MLC';

/** Select the best Gemma 4 model for the current device based on RAM. */
export function selectGemma4Model(): string {
  return GEMMA4_E2B_MODEL_ID;
}
