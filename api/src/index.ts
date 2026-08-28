// api/src/index.ts
// Package entry point: the typed proof ports web/ consumes, plus both
// implementations behind them. Everything else in this workspace (the
// contract loader, environment/provider wiring, the demo runner) stays
// internal — only the seam is exported here.

export type { ApiDegraded, ApiFailureReason, ApiResult } from "./types.js";
export type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";
export { createStubBackingPort, createStubIdentityPort } from "./stubProofPort.js";
export { createRealBackingPort, createRealIdentityPort, type PortLogger } from "./realProofPort.js";
