import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * IMPORTANT – Cross-Origin Isolation is REQUIRED for SharedArrayBuffer.
 *
 * WebLLM / WebGPU use SharedArrayBuffer internally. The browser only exposes
 * SharedArrayBuffer in a "cross-origin isolated" context, which means your
 * server MUST send these two HTTP response headers on every page:
 *
 *   Cross-Origin-Opener-Policy:   same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * The Vite dev-server and preview server send them automatically (see below).
 *
 * For PRODUCTION deployments (Nginx, Apache, Vercel, Netlify, Cloudflare…)
 * you must configure your host to attach these headers. For example in
 * vercel.json:
 *   {
 *     "headers": [
 *       { "source": "/(.*)",
 *         "headers": [
 *           { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
 *           { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
 *         ]
 *       }
 *     ]
 *   }
 */
export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [react()],

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Emit Web Workers as ES modules (required for top-level await & imports
  // inside the worker).
  worker: {
    format: 'es',
  },

  optimizeDeps: {
    // WebLLM ships pre-built ESM bundles – skip Vite's dependency
    // pre-bundling step to avoid double-bundling or broken dynamic imports.
    exclude: ['@mlc-ai/web-llm'],
  },
});
