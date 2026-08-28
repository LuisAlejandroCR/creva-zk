// api/src/stubProofPort.ts
// The synthetic implementation of both proof ports: deterministic outcomes
// derived from each circuit's own public arguments alone, no network or
// provider involved. This is the default until the real port's call path
// is finished.

import type { ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";

const STUB_CLEAR_THRESHOLD = 3_000n;

export function createStubBackingPort(): BackingProofPort {
  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      const tier: Tier = requestedLimit <= STUB_CLEAR_THRESHOLD ? "silver" : "none";
      return { status: "ok", value: tier };
    },
  };
}

export function createStubIdentityPort(): IdentityProofPort {
  return {
    async checkIdentity(_issuerKey: JubjubPoint, _expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      return { status: "ok", value: true };
    },
  };
}
