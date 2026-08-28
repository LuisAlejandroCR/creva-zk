// vite-env.d.ts
// Pulls in Vite's client types so `import.meta.env` is typed, and declares
// the variables this app reads: the proof-port source used by the seam, and
// the address of the proof server the bridge port fetches.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'real' or 'bridge' drives the screens from an actual proof; anything else uses the stub. */
  readonly VITE_PORT_SOURCE?: string;
  /** Base URL of api/'s proof server for the 'bridge' source; defaults to http://localhost:8787. */
  readonly VITE_BRIDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
