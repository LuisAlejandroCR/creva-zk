// api/src/proofPort.ts
// The one typed port web/ consumes: given a requested limit, returns the
// backing outcome or a typed degraded result — never a throw. The identity
// predicate gets its own port with the same shape.

import type { ApiResult } from "./types.js";

// Stub of the tier the backing circuit derives, mirrored locally the same
// way advisor/src/types.ts and web/src/domain/tier.ts do — no shared
// `Tier` type exists yet to import instead.
export type Tier = "none" | "bronze" | "silver" | "gold";

export interface BackingProofPort {
  readonly checkBacking: (requestedLimit: bigint) => Promise<ApiResult<Tier>>;
}

export interface IdentityProofPort {
  readonly checkIdentity: (requestedLimit: bigint) => Promise<ApiResult<boolean>>;
}
