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
| LLM inference | `@mlc-ai/web-llm` v0.2.79 via WebGPU |
| Icons | `lucide-react` |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Unique IDs | `uuid` |
| Build tool | Vite 6 |

---

## File Structure

```
src/
├── App.tsx                     Main layout: mode picker, sidebar, input form, settings modal
├── main.tsx                    React root mount
├── index.css                   Tailwind directives, custom scrollbar, typing-cursor keyframe
├── types.ts                    Shared types + worker message protocol (ToWorker / FromWorker)
├── engine.worker.ts            Web Worker — runs MLCEngine off the main thread
├── hooks/
│   └── useWebLLM.ts            Custom hook: worker lifecycle, routing, streaming, persistence
├── classifier/
│   └── router.ts               Trained TF-IDF + logistic regression router (auto-generated)
├── components/
│   ├── Sidebar.tsx             Conversation list + dual-model status footer
│   ├── ChatContainer.tsx       Message list, think-block UI, markdown, copy, scroll
│   └── SettingsModal.tsx       System prompt editor overlay
scripts/
├── train_router.py             Training script for the classifier
└── data/
    ├── instant.txt             Training examples — instant/conversational messages
    └── reasoning.txt           Training examples — complex/reasoning messages
```

---

## Models

The app uses two models simultaneously:

| Constant | Model ID | Purpose |
|---|---|---|
| `INSTANT_MODEL` | `gemma-2b-it-q4f32_1-MLC` | Fast, conversational replies (~1.5 GB) |
| `REASONING_MODEL` | `Qwen3-1.7B-q4f16_1-MLC` | Deep reasoning with `<think>` blocks (~1 GB) |

Both constants are defined in `src/types.ts`.

---

## Mode Picker

Three modes are selectable in the header:

- **⚡ Instant** — always uses the fast Gemma 2B model.
- **🔀 Auto** — uses the trained classifier in `src/classifier/router.ts` to decide per message which model to use. The routing decision is shown as a badge next to the mode tabs.
- **🧠 Reasoning** — always uses Qwen3-1.7B with extended thinking.

The selected mode is persisted to `localStorage` under `webllm_mode`.

---

## Model Routing Classifier

The Auto mode router is a **TF-IDF + logistic regression** classifier compiled to a single TypeScript file with no runtime dependencies. Inference is a dot product + sigmoid — ~0 ms per message.

### Retrain the classifier

1. Add training examples (one per line) to:
   - `scripts/data/instant.txt` — conversational/factual questions
   - `scripts/data/reasoning.txt` — math, coding, multi-step analysis
2. Run:
   ```bash
   pip install scikit-learn numpy
   python scripts/train_router.py
   ```
3. The script prints 5-fold CV accuracy and overwrites `src/classifier/router.ts` with the new weights. Rebuild to apply.

Aim for 100–200 examples per class for reliable accuracy.

---

## Background Model Preload

On startup, after the instant model is ready, the app automatically checks whether the reasoning model weights are already in IndexedDB (via `hasModelInCache`). If not, it downloads them silently in a background worker.

Progress is shown in the sidebar footer with a violet progress bar. Both model statuses are always visible there:

- **Instant** — emerald indicator, shows download % during init
- **Reasoning** — violet indicator, shows preload % with animated progress bar

---

## Thinking UI

When the reasoning model responds, it emits a `<think>...</think>` block before the actual answer. The UI:

- Shows a pulsing 🧠 **"Thinking…"** label and the live thought stream while the model is still inside the `<think>` block
- Auto-collapses to **"Thought for a moment"** + a chevron once thinking ends
- Click the label at any time to expand / collapse the thought trace
- The **Copy** button copies only the final answer, stripping the think block

---

## Architecture

### Web Worker (`engine.worker.ts`)

The entire WebLLM engine lives in a dedicated Web Worker so the UI thread never freezes.

**Message protocol** (`src/types.ts`):

**Main → Worker (`ToWorker`)**

| Message | Purpose |
|---|---|
| `{ type: 'init', model }` | Load and compile the initial model |
| `{ type: 'reload', model }` | Hot-swap to a different model |
| `{ type: 'preload', model }` | Download a model in the background without switching to it |
| `{ type: 'generate', id, messages }` | Start a streaming chat completion |
| `{ type: 'abort' }` | Stop the current stream |

**Worker → Main (`FromWorker`)**

| Message | Purpose |
|---|---|
| `{ type: 'progress', progress, text }` | Download/compile progress 0–100 |
| `{ type: 'ready', cached }` | Model fully loaded |
| `{ type: 'preload_progress', model, progress, text }` | Background download progress |
| `{ type: 'preload_done', model }` | Background download complete |
| `{ type: 'chunk', id, delta }` | One streaming token |
| `{ type: 'done', id }` | Generation finished |
| `{ type: 'error', message }` | Unrecoverable failure |

### `useWebLLM` hook (`src/hooks/useWebLLM.ts`)

- Spawns the worker once on mount, terminates on unmount.
- Tracks `status`: `'loading' | 'switching' | 'ready' | 'generating' | 'error'`.
- `switching` state is shown in the header while hot-swapping models; the `generate` call is queued in `pendingGenerateRef` and fires automatically once the new model is ready.
- `loadedModelRef` tracks which model is currently active in the worker.
- Manages multi-conversation state, persisted to `localStorage` (`webllm_conversations`).
- `sendMessage` appends a user message, routes it if in Auto mode, switches model if needed, then streams the reply.

**Exposed fields (selection):**

| Field | Type | Description |
|---|---|---|
| `status` | `EngineStatus` | Current engine state |
| `mode` / `setMode` | `EngineMode` | Selected routing mode |
| `activeModel` | `string` | Model currently loaded in the worker |
| `lastRouteDecision` | `'instant' \| 'reasoning' \| null` | Last Auto-mode routing decision |
| `reasoningCached` | `boolean` | Whether reasoning model weights are in IndexedDB |
| `preloadProgress` | `number \| null` | Background download progress 0–100 |
| `preloadText` | `string` | Human-readable preload status text |

---

## Settings

Click the gear icon ⚙ in the sidebar footer to open Settings. Currently exposes:

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
- **`engine.reload(model)`** only accepts one argument in the installed package version — the init progress callback registered at startup is reused automatically.
- **`ToWorker` / `FromWorker` unions** in `types.ts` are the single source of truth for the worker protocol.
- **Conversation persistence:** messages are saved to `localStorage` after each `done` event.
- **Streaming cursor** is a pure-CSS `::after` pseudo-element with a blink keyframe (`typing-cursor` class in `index.css`).

