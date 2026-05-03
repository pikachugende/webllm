# WebLLM Chat

A high-fidelity ChatGPT-style chat interface that runs language models **100% locally in the browser** using WebGPU. No backend, no API keys, no data leaves the device.

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173. On first load the model weights download and are cached in IndexedDB — subsequent loads are instant.

**Browser requirements:** Chrome 113+ or Edge 113+ with WebGPU enabled. Firefox does not support WebGPU by default.

---

## Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 + TypeScript |
| Styling | Tailwind CSS v3 + `@tailwindcss/typography` |
| LLM inference | `@mlc-ai/web-llm` v0.2.83 via WebGPU |
| Icons | `lucide-react` |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Unique IDs | `uuid` |
| Build tool | Vite 6 |

---

## File Structure

```
src/
├── App.tsx                     Main layout: sidebar, input form, settings modal
├── main.tsx                    React root mount
├── index.css                   Tailwind directives, custom scrollbar, typing-cursor keyframe
├── types.ts                    Shared types + worker message protocol (ToWorker / FromWorker)
├── engine.worker.ts            Web Worker — runs MLCEngine off the main thread
├── hooks/
│   └── useWebLLM.ts            Custom hook: worker lifecycle, streaming, persistence
├── classifier/
│   └── router.ts               Retained for reference — no longer used with Gemma 4
├── components/
│   ├── Sidebar.tsx             Conversation list + model status footer
│   ├── ChatContainer.tsx       Message list, think-block UI, markdown, copy, scroll
│   └── SettingsModal.tsx       System prompt editor overlay
scripts/
├── train_router.py             Training script for the classifier
└── data/
    ├── instant.txt             Training examples — instant/conversational messages
    └── reasoning.txt           Training examples — complex/reasoning messages
```

---

## Model

The app uses a single **Gemma 4** model with native thinking support:

| Variant | Model ID | Source |
|---|---|---|
| E2B | `gemma-4-E2B-it-q4f16_1-MLC` | `welcoma/gemma-4-E2B-it-q4f16_1-MLC` (community MLC) |
| E4B | `gemma-4-E4B-it-q4f16_1-MLC` | Not yet publicly available |

On startup, `navigator.deviceMemory` is checked. If ≥ 6 GB, E4B is selected; otherwise E2B.

The model emits `<think>...</think>` blocks for deep reasoning and responds directly for simple queries — no separate reasoning model is needed.

---

## Thinking UI

When the model responds, it may emit a `<think>...</think>` block before the actual answer. The UI:

- Shows a pulsing **"Thinking…"** label and the live thought stream while the model is still inside the `<think>` block
- Auto-collapses to **"Thought for a moment"** + a chevron once thinking ends
- Click the label at any time to expand / collapse the thought trace
- The **Copy** button copies only the final answer, stripping the think block

---

## Architecture

### Web Worker (`engine.worker.ts`)

The entire WebLLM engine lives in a dedicated Web Worker so the UI thread never freezes.

The worker builds a custom `AppConfig` to load Gemma 4 from its community HuggingFace repo, since the model is not in `@mlc-ai/web-llm`'s prebuilt catalog.

**Message protocol** (`src/types.ts`):

**Main → Worker (`ToWorker`)**

| Message | Purpose |
|---|---|
| `{ type: 'init', model }` | Load and compile the model |
| `{ type: 'generate', id, messages }` | Start a streaming chat completion |
| `{ type: 'abort' }` | Stop the current stream |

**Worker → Main (`FromWorker`)**

| Message | Purpose |
|---|---|
| `{ type: 'progress', progress, text }` | Download/compile progress 0–100 |
| `{ type: 'ready', cached }` | Model fully loaded |
| `{ type: 'chunk', id, delta }` | One streaming token |
| `{ type: 'done', id }` | Generation finished |
| `{ type: 'error', message }` | Unrecoverable failure |

### `useWebLLM` hook (`src/hooks/useWebLLM.ts`)

- Detects device RAM and selects the optimal Gemma 4 model on mount.
- Spawns the worker once on mount, terminates on unmount.
- Tracks `status`: `'loading' | 'ready' | 'generating' | 'error'`.
- Manages multi-conversation state, persisted to `localStorage` (`webllm_conversations`).
- `sendMessage` appends a user message and streams the reply.

**Exposed fields (selection):**

| Field | Type | Description |
|---|---|---|
| `status` | `EngineStatus` | Current engine state |
| `activeModel` | `string` | Model currently loaded |
| `progress` | `number` | Download/compile progress 0–100 |
| `progressText` | `string` | Human-readable progress text |
| `conversations` | `Conversation[]` | All saved conversations |

---

## Settings

Click the gear icon in the sidebar footer to open Settings. Currently exposes:

- **System prompt** — custom instructions prepended to every conversation. Supports multi-line text. Saved to `localStorage` under `webllm_system_prompt`. A Reset button restores the default prompt.

---

## Other Features

- **Multi-conversation sidebar** — create, rename (auto-titled by the model after the first reply), and delete conversations. History persists across page reloads.
- **File uploads** — attach `.txt`, `.md`, `.csv`, `.json`, `.py`, `.js`, `.ts`, `.html`, `.css`, `.xml` files; their content is injected into the user message.
- **Image uploads** — attach images (for vision-capable models). Shown as inline thumbnails in the chat.
- **Speech-to-text** — press the microphone button to dictate using the Web Speech API.
- **Search** — filter conversations by title or content using the search bar in the sidebar.
- **Code blocks** — syntax-highlighted, with a one-click Copy button that appears on hover.
- **Streaming cursor** — live blinking cursor while the model generates.
- **Scroll-to-bottom button** — appears when scrolled up, snaps back to the latest message.
- **Regenerate** — re-runs the last assistant turn with the same model and context.

---

## Cross-Origin Isolation (COOP/COEP)

WebGPU requires `SharedArrayBuffer`, which browsers only allow in a cross-origin isolated context. Both headers are set by Vite for dev and preview:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

For **production** deployments add these headers in your hosting config (Nginx, Vercel, Netlify, Cloudflare, etc.).

---

## Key Decisions & Gotchas

- **Vite worker format is `'es'`** — required for top-level `await` and ESM imports inside the worker.
- **`@mlc-ai/web-llm` is excluded from Vite pre-bundling** (`optimizeDeps.exclude`) to avoid double-bundling.
- **Custom `appConfig`** — the worker constructs an `AppConfig` with the HuggingFace repo URL and WASM library path so `@mlc-ai/web-llm` can load Gemma 4 from `welcoma/` (community MLC, not the official `mlc-ai` catalog).
- **RAM-based model selection** — `navigator.deviceMemory` determines the Gemma 4 variant at startup. E4B is selected for ≥6 GB devices.
- **`ToWorker` / `FromWorker` unions** in `types.ts` are the single source of truth for the worker protocol.
- **Conversation persistence:** messages are saved to `localStorage` after each `done` event.
- **Streaming cursor** is a pure-CSS `::after` pseudo-element with a blink keyframe (`typing-cursor` class in `index.css`).
