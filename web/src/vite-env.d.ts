// vite-env.d.ts
// Pulls in Vite's client types so `import.meta.env` is typed, and declares
// the one variable this app reads: the proof-port source used by the seam.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'real' drives the screens from an actual proof; anything else uses the stub. */
  readonly VITE_PORT_SOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
