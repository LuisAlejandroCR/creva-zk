// vite.config.ts
// Build config for the web workspace: plain static output, source maps on
// for debugging the installed PWA.

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
