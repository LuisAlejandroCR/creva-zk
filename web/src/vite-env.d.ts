// vite-env.d.ts
// Pulls in Vite's client types so `import.meta.env` is typed, and declares
// the variables this app reads: the proof-port source used by the seam, the
// address of the proof server the bridge port fetches, and the five the
// browser-direct Lace path reads — three of which name a deployment it
// cannot run without.

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
  /**
   * Hex address of the identity contract, deployed once by the operator tool
   * (see src/deployTool.ts). The 'lace' source JOINS it, exactly as it joins
   * the backing one. Without it — or without VITE_IDENTITY_ISSUER_KEY — the
   * identity port degrades `contract_not_found` and joins nothing.
   */
  readonly VITE_IDENTITY_CONTRACT_ADDRESS?: string;
  /**
   * The key `proveIdentity` verifies the attestation's signature against, as
   * "x:y" with BOTH coordinates in DECIMAL — for example "123...:456...".
   * The operator tool prints it in exactly that form beside the address.
   *
   * Never a compressed point: nothing in this repository can decompress one,
   * so a hex string here would be a value nobody could turn back into the
   * (x, y) pair the circuit takes. A malformed value is treated as absent.
   */
  readonly VITE_IDENTITY_ISSUER_KEY?: string;
  /** Where the compiled circuit's prover/verifier keys and ZKIR are served from; defaults to /zk. */
  readonly VITE_ZK_CONFIG_URL?: string;
  /**
   * '1' puts the operator deployment tool on the page instead of the journey.
   * Either deployment there — backing or identity — costs tDUST and creates a
   * new contract, so it is never on by default and never runs on load; see
   * src/deployTool.ts.
   */
  readonly VITE_LACE_DEPLOY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
