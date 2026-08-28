// types.ts
// Domain types for the backing (collateral) issuer. Mirrors
// backing-tier.compact's BackingClaim struct — never imported from
// contract/, which this workspace does not touch, so the field is
// restated here.

import type { JubjubPoint, IssuerResult } from "../types.js";

export interface CollateralClaim {
  readonly collateral: bigint; // mirrors Compact's Uint<64>
}

export interface BackingIssuerPort {
  issue(subjectKey: JubjubPoint, claim: CollateralClaim): Promise<IssuerResult<CollateralClaim>>;
}
