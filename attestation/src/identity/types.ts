// types.ts
// Domain types for the identity issuer. Mirrors identity-check.compact's
// IdentityClaim struct — never imported from contract/, which this
// workspace does not touch, so the fields are restated here.

import type { JubjubPoint, IssuerResult } from "../types.js";

export interface IdentityClaim {
  readonly verified: boolean;
  readonly ofAge: boolean;
  readonly taxId: string; // hex, 32 bytes — mirrors Compact's Bytes<32>
}

// Creva's KYC provider has signed nothing since it disconnected on
// 2026-08-20 — this port has exactly one implementation,
// SyntheticIdentityIssuer, and no adapter to any external system.
export interface IdentityIssuerPort {
  issue(subjectKey: JubjubPoint, claim: IdentityClaim): Promise<IssuerResult<IdentityClaim>>;
}
