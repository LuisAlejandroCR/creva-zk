// vite.config.ts
// Build config for the web workspace: plain static output, source maps on
// for debugging the installed PWA, and the WebAssembly plugin loaded only
// for the browser-direct source — Midnight's ledger is WASM, and no other
// build may pay for it.

import { defineConfig, loadEnv } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig(({ mode }) => {
  const laceBuild = loadEnv(mode, process.cwd(), 'VITE_').VITE_PORT_SOURCE === 'lace';

  return {
    // GitHub Pages serves a project site under /<repo>/, so every asset URL has
    // to carry that prefix. Overridable, because the same build has to work
    // from a plain file server and from localhost.
    base: process.env.VITE_BASE ?? '/',
    // Rollup walks a dynamic import's module graph before it eliminates the
    // dead branch around it, so on any other source the ledger's WebAssembly
    // would still be resolved, transformed and emitted — 11 MB nothing
    // references. Aliasing the entry away is what actually keeps it out.
    resolve: laceBuild ? {} : { alias: { '@creva-zk/api/lace': '/src/laceUnavailable.ts' } },
    plugins: laceBuild ? [wasm()] : [],
    build: {
      outDir: 'dist',
      sourcemap: true,
      // The ledger's WASM initialiser runs at the top level of its module,
      // so the lace output has to target a level where top-level await is
      // native. Vite's default es2020 floor is not.
      target: 'es2022',
    },
  };
});
