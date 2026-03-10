/**
 * engine.worker.ts
 *
 * Runs the WebLLM MLCEngine entirely off the main thread.
 * The UI thread communicates via postMessage; this worker handles:
 *   – Model initialisation with download-progress callbacks
 *   – Streaming chat completions (token-by-token)
 *   – Abort signals
 *
 * ─── MANDATORY server headers (Cross-Origin Isolation) ──────────────────────
 * SharedArrayBuffer (required by WebGPU/WebLLM) is only available when the
 * page is served with BOTH of the following HTTP headers:
 *
 *   Cross-Origin-Opener-Policy:   same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *‚
 * The Vite dev-server already sends these (see vite.config.ts).
 * You MUST replicate this in your production server / CDN config.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CreateMLCEngine } from '@mlc-ai/web-llm';
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import type { ToWorker, FromWorker } from './types';

// ── State ────────────────────────────────────────────────────────────────────

let engine: MLCEngine | null = null;
let abortRequested = false;

// Shared progress callback — stored so it can be reused on reload.
const progressCb = (report: InitProgressReport) => {
  self.postMessage({
    type: 'progress',
    progress: Math.round(report.progress * 100),
    text: report.text,
  } satisfies FromWorker);
};

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;

  switch (msg.type) {
    // ── Initialise the engine (download + compile) ─────────────────────────
    case 'init': {
      try {
        engine = await CreateMLCEngine(msg.model, {
          initProgressCallback: progressCb,
        });
        self.postMessage({ type: 'ready', cached: true } satisfies FromWorker);
      } catch (err) {
        self.postMessage({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        } satisfies FromWorker);
      }
      break;
    }

    // ── Hot-swap model (reuses IndexedDB cache when available) ─────────────
    case 'reload': {
      if (!engine) {
        self.postMessage({
          type: 'error',
          message: 'Engine not initialised — cannot reload.',
        } satisfies FromWorker);
        break;
      }
      try {
        await engine.reload(msg.model);
        self.postMessage({ type: 'ready', cached: true } satisfies FromWorker);
      } catch (err) {
        self.postMessage({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        } satisfies FromWorker);
      }
      break;
    }

    // ── Background pre-download: fetch weights without swapping the active engine ─
    case 'preload': {
      const preloadModel = msg.model;
      try {
        // Create a temporary throw-away engine solely to trigger the download and
        // cache the weights into IndexedDB. We then unload it immediately so the
        // active engine keeps its GPU memory.
        const tmp = await CreateMLCEngine(preloadModel, {
          initProgressCallback: (report: InitProgressReport) => {
            self.postMessage({
              type: 'preload_progress',
              model: preloadModel,
              progress: Math.round(report.progress * 100),
              text: report.text,
            } satisfies FromWorker);
          },
        });
        // Unload GPU resources of the temp engine without destroying the main engine.
        await tmp.unload();
        self.postMessage({ type: 'preload_done', model: preloadModel } satisfies FromWorker);
      } catch (err) {
        // Preload failures are non-fatal — just log, don't crash the worker.
        console.warn('[preload] failed for', preloadModel, err);
        self.postMessage({ type: 'preload_done', model: preloadModel } satisfies FromWorker);
      }
      break;
    }

    // ── Stream a chat completion ───────────────────────────────────────────
    case 'generate': {
      if (!engine) {
        const response: FromWorker = {
          type: 'error',
          message: 'Engine is not initialised yet.',
        };
        self.postMessage(response);
        return;
      }

      abortRequested = false;

      try {
        const stream = await engine.chat.completions.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: msg.messages as any,
          stream: true,
          temperature: 0.7,
          top_p: 0.95,
        });

        for await (const chunk of stream) {
          if (abortRequested) break;

          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            const response: FromWorker = { type: 'chunk', id: msg.id, delta };
            self.postMessage(response);
          }
        }
      } catch (err) {
        const response: FromWorker = {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(response);
      } finally {
        // Always signal completion so the hook can reset status.
        const response: FromWorker = { type: 'done', id: msg.id };
        self.postMessage(response);
        abortRequested = false;
      }
      break;
    }

    // ── Abort the current stream ───────────────────────────────────────────
    case 'abort': {
      abortRequested = true;
      break;
    }
  }
};
