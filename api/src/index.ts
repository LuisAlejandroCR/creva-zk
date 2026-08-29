// api/src/index.ts
// Package entry point: the typed proof ports web/ consumes, plus both
// implementations behind them. Everything else in this workspace (the
// contract loader, environment/provider wiring, the demo runner, the HTTP
// proof server) stays internal — only the seam is exported here, and only
// browser-safe modules, so bundling this entry never pulls in node: or
// testcontainers. The browser-direct Lace path is deliberately NOT here: it
// reaches Midnight's WebAssembly ledger, so it lives behind its own
// "@creva-zk/api/lace" entry and only a build on that source pays for it.

export type { ApiDegraded, ApiFailureReason, ApiResult } from "./types.js";
export type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";
export { createStubBackingPort, createStubIdentityPort } from "./stubProofPort.js";
export { createRealBackingPort, createRealIdentityPort, type PortLogger } from "./realProofPort.js";
export {
  createBridgeBackingPort,
  createBridgeIdentityPort,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_BRIDGE_URL,
  type BridgeOptions,
} from "./bridgeProofPort.js";
