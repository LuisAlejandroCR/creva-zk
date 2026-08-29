// vite-env.d.ts
// Pulls in Vite's client types so `import.meta.env` is typed, and declares
// the variables this app reads: the proof-port source used by the seam, the
// address of the proof server the bridge port fetches, and the two the
// browser-direct Lace path can override.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'real', 'bridge' or 'lace' drives the screens from an actual proof; anything else uses the stub. */
  readonly VITE_PORT_SOURCE?: string;
  /** Base URL of api/'s proof server for the 'bridge' source; defaults to http://localhost:8787. */
  readonly VITE_BRIDGE_URL?: string;
  /** Network id the 'lace' source insists the wallet is on; defaults to 'testnet'. */
  readonly VITE_LACE_NETWORK_ID?: string;
  /** Where the compiled circuit's prover/verifier keys and ZKIR are served from; defaults to /zk. */
  readonly VITE_ZK_CONFIG_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
