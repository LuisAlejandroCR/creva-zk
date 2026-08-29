// vite-env.d.ts
// Pulls in Vite's client types so `import.meta.env` is typed, and declares
// the variables this app reads: the proof-port source used by the seam, the
// address of the proof server the bridge port fetches, and the three the
// browser-direct Lace path reads — one of which it cannot run without.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'real', 'bridge' or 'lace' drives the screens from an actual proof; anything else uses the stub. */
  readonly VITE_PORT_SOURCE?: string;
  /** Base URL of api/'s proof server for the 'bridge' source; defaults to http://localhost:8787. */
  readonly VITE_BRIDGE_URL?: string;
  /** Network id the 'lace' source insists the wallet is on; defaults to 'preprod'. */
  readonly VITE_LACE_NETWORK_ID?: string;
  /**
   * Hex address of the backing contract, deployed once from the CLI. The
   * 'lace' source JOINS it rather than deploying from the browser, so without
   * this it has nothing to join and degrades `contract_not_found`.
   */
  readonly VITE_BACKING_CONTRACT_ADDRESS?: string;
  /** Where the compiled circuit's prover/verifier keys and ZKIR are served from; defaults to /zk. */
  readonly VITE_ZK_CONFIG_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
