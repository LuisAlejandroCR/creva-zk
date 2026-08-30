// api/src/index.ts
// Package entry point: the typed proof ports web/ consumes, plus both
// implementations behind them. Everything else in this workspace (the
// contract loader, environment/provider wiring, the demo runner, the HTTP
// proof server) stays internal — only the seam is exported here, and only
// browser-safe modules, so bundling this entry never pulls in node: or
// testcontainers. Two paths are deliberately NOT here. The browser-direct
// Lace path reaches Midnight's WebAssembly ledger, so it lives behind
// "@creva-zk/api/lace" and only a build on that source pays for it; the real
// in-process path now reaches Docker and node:, so it lives behind
// "@creva-zk/api/real" and no browser build may reach it at all.

export type { ApiDegraded, ApiFailureReason, ApiResult } from "./types.js";
export type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";
export { createStubBackingPort, createStubIdentityPort } from "./stubProofPort.js";
export type { PortLogger } from "./portLogger.js";
export {
  createBridgeBackingPort,
  createBridgeIdentityPort,
  fetchIdentityIssuerKey,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_BRIDGE_URL,
  type BridgeOptions,
} from "./bridgeProofPort.js";

export { DEMO_TAX_ID_HEX } from "./identityDemo.js";
