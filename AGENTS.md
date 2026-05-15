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

## Model selection

The app shows a model picker on first load. Users can switch models later via Settings → Change model. All models support the thinking toggle.

- **Catalog**: Defined in `src/models.ts` (Gemma 4 E2B + Qwen3 family).
- **Recommendation**: Based on `navigator.deviceMemory` (2/4/6/8+ GB buckets). Gemma 4 E2B is recommended at 6+ GB.
- **Custom model source**: Gemma 4 E2B uses `welcoma/gemma-4-E2B-it-q4f16_1-MLC` on HuggingFace (not in `@mlc-ai/web-llm` prebuilt list).
- **Worker appConfig**: `src/engine.worker.ts` supplies custom config for Gemma 4, and prebuilt config for all other models.
- **`@mlc-ai/web-llm` is pinned to `^0.2.83`** — upgrading requires checking for new model WASM library compatibility.

## Web Worker message protocol

The single source of truth for worker communication is `src/types.ts` — the `ToWorker` and `FromWorker` discriminated unions. Every message crossing the worker boundary must be a member of one of these unions.

## Key architecture facts

- **Worker**: `src/engine.worker.ts` runs the MLCEngine off the main thread. It handles init, generate, and abort. Model is selected by the UI and reloaded via a new worker instance.
- **Hook**: `src/hooks/useWebLLM.ts` orchestrates the worker, manages conversations in localStorage, streams responses, and applies the auto-thinking router.
- **Auto routing**: `src/classifier/router.ts` is used in Auto mode alongside heuristics in `useWebLLM.ts`.
- **Thinking UI**: The `ChatContainer` parses `<think>...</think>` blocks from the model output. The UI shows a collapsible thinking panel, same as before.

## Adding a new model

1. Add a new entry in `src/models.ts`.
2. If it is a custom MLC model, extend `buildAppConfig()` in `src/engine.worker.ts`.
3. Ensure it supports the thinking toggle (`enable_thinking` works for it).

## localStorage keys (do not rename without migration)

- `webllm_conversations` — array of `Conversation` objects
- `webllm_system_prompt` — user-defined system prompt string
- `webllm_selected_model` — model ID chosen in the picker
- `webllm_thinking_mode` — `instant` | `auto` | `thinking`

## GitHub Pages deploy

Push to `main`/`master` triggers `.github/workflows/deploy.yml`, which builds with `VITE_BASE_URL: /${{ github.event.repository.name }}/` and deploys the `dist/` folder.
