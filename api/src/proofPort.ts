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

// Compact's JubjubPoint: the (x, y) Field pair proveIdentity actually
// takes. Restated here rather than imported from attestation/ or the
// runtime (see this file's header — no shared package to import from),
// but structurally identical to both, so a key crosses this boundary
// ready to be a circuit argument. It is deliberately NOT a compressed hex
// string: a compressed point has to be decompressed by someone before the
// circuit can use it, and that someone never existed.
export interface JubjubPoint {
  readonly x: bigint;
  readonly y: bigint;
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
