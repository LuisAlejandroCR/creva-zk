// api/src/proofPort.ts
// The typed ports web/ consumes: each takes exactly the public arguments
// its circuit takes and returns that circuit's outcome or a typed degraded
// result — never a throw. Same ApiResult<T> shape for both; different
// arguments, because backing and identity are different predicates.

import type { ApiResult } from "./types.js";

// Stub of the tier the backing circuit derives, mirrored locally the same
// way advisor/src/types.ts and web/src/domain/tier.ts do — no shared
// `Tier` type exists yet to import instead.
export type Tier = "none" | "bronze" | "silver" | "gold";

// Mirrors Compact's JubjubPoint the same way attestation/src/types.ts does:
// a single compressed hex string off the wire, not imported from that
// workspace (see this file's header — no shared package to import from).
export interface JubjubPoint {
  readonly compressed: string; // hex
}

// proveBacking(requestedLimit: Uint<64>) -> Boolean — see
// contract/src/backing.compact.
export interface BackingProofPort {
  readonly checkBacking: (requestedLimit: bigint) => Promise<ApiResult<Tier>>;
}

// proveIdentity(issuerKey: JubjubPoint, expectedTaxIdHash: Bytes<32>) ->
// Boolean — see contract/src/identity-check.compact. Identity has no
// requested limit; it takes the issuer's public key and the tax ID hash
// the caller expects the attestation to match.
export interface IdentityProofPort {
  readonly checkIdentity: (issuerKey: JubjubPoint, expectedTaxIdHash: string) => Promise<ApiResult<boolean>>;
}
