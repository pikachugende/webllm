# Agents.md

## Commands

```bash
npm run dev          # start Vite dev server on :5173 (sets COOP/COEP headers)
npm run build        # tsc type-check → vite build (outputs to dist/)
npm run preview      # serve the production build locally
```

There is **no lint, test, or typecheck command**. The `build` script runs `tsc` first, which type-checks without emitting (`noEmit: true`). There is no ESLint or test framework configured.

## Browser requirement

Chrome 113+ or Edge 113+ with WebGPU enabled. Firefox does not support WebGPU by default and will not work.

## Critical: COOP / COEP headers (SharedArrayBuffer)

WebLLM/WebGPU require `SharedArrayBuffer`, which browsers only expose with cross-origin isolation headers:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **Dev & preview**: Vite sets these automatically via `vite.config.ts` headers config.
- **Production**: You MUST configure these in your hosting layer (Nginx, Vercel, Netlify, etc.).
- **GitHub Pages workaround**: `public/coi-serviceworker.js` is loaded in `index.html` to polyfill headers on pages that don't send them. Do not remove this script if deploying to GitHub Pages.

## Vite config gotchas

- **Worker format is `'es'`** — required for top-level `await` and ESM imports inside `engine.worker.ts`.
- **`@mlc-ai/web-llm` is excluded from pre-bundling** (`optimizeDeps.exclude`) to avoid double-bundling.
- **`VITE_BASE_URL` env var** controls the `<base>` path (default `/`). The GitHub Pages deploy workflow sets it to `/<REPO_NAME>/`.

## Model: Gemma 4

The app uses a single Gemma 4 model with native thinking support. No separate "reasoning" model is needed — the model emits `<think>...</think>` blocks internally.

- **Model source**: Community MLC model from `welcoma/gemma-4-E2B-it-q4f16_1-MLC` on HuggingFace (not in `@mlc-ai/web-llm`'s prebuilt catalog).
- **Worker passes custom `appConfig`** to `CreateMLCEngine` with the HuggingFace repo URL and WASM model library path.
- **RAM detection**: On startup, `navigator.deviceMemory` is checked. If ≥ 6 GB, the E4B model is selected; otherwise E2B. The E4B model is not yet publicly available but the detection logic is in place.
- **Model IDs** are defined in `src/types.ts` as `GEMMA4_E2B_MODEL_ID` / `GEMMA4_E4B_MODEL_ID`.
- **`@mlc-ai/web-llm` is pinned to `^0.2.83`** — the latest version. Upgrading requires checking for new model WASM library compatibility.

## Web Worker message protocol

The single source of truth for worker communication is `src/types.ts` — the `ToWorker` and `FromWorker` discriminated unions. Every message crossing the worker boundary must be a member of one of these unions.

## Key architecture facts

- **Worker**: `src/engine.worker.ts` runs the entire MLCEngine off the main thread. It handles init, generate, and abort. No reload or preload — only one model is used.
- **Hook**: `src/hooks/useWebLLM.ts` is the central orchestrator — spawns/terminates the worker, manages conversations in localStorage, handles streaming. No model switching, no classifier routing.
- **Classifier**: `src/classifier/router.ts` is retained for reference but is **no longer used** — Gemma 4 handles thinking/instant responses natively.
- **Single model architecture**: No more dual-model setup. The Gemma 4 model handles both quick responses and deep thinking internally.
- **Thinking UI**: The `ChatContainer` parses `<think>...</think>` blocks from the model output. The UI shows a collapsible thinking panel, same as before.

## Adding a new Gemma 4 model

If a new Gemma 4 variant (e.g. E4B) becomes available on HuggingFace:

1. Add the model ID constant in `src/types.ts`
2. Add the HuggingFace repo URL and WASM path in `src/engine.worker.ts` (`buildAppConfig`)
3. Update `selectGemma4Model()` in `src/types.ts` with the RAM threshold

## localStorage keys (do not rename without migration)

- `webllm_conversations` — array of `Conversation` objects
- `webllm_system_prompt` — user-defined system prompt string

## GitHub Pages deploy

Push to `main`/`master` triggers `.github/workflows/deploy.yml`, which builds with `VITE_BASE_URL: /${{ github.event.repository.name }}/` and deploys the `dist/` folder.
