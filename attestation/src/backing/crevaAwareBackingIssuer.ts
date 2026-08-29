// crevaAwareBackingIssuer.ts
// Composes the Creva API connectivity check with the real and synthetic
// backing issuers so a caller never has to branch on Creva's status
// itself: with the API up, collateral gets Creva's real signature; with it
// down, the same claim gets a synthetic one instead, so the whole flow —
// backing tier included — keeps running against synthetic attestations.

import type { CrevaApiPort } from "../crevaApi/types.js";
import type { JubjubPoint, IssuerResult } from "../types.js";
import type { CollateralClaim, BackingIssuerPort } from "./types.js";

export class CrevaAwareBackingIssuer implements BackingIssuerPort {
  constructor(
    private readonly api: CrevaApiPort,
    private readonly real: BackingIssuerPort,
    // Required, like the real issuer: the synthetic fallback now needs a
    // signer carrying the contract's challenge circuit, so there is no
    // sensible default this class could construct on its own.
    private readonly synthetic: BackingIssuerPort,
  ) {}

  async issue(subjectKey: JubjubPoint, claim: CollateralClaim): Promise<IssuerResult<CollateralClaim>> {
    const apiStatus = await this.api.checkStatus();
    const issuer = apiStatus.status === "available" ? this.real : this.synthetic;
    return issuer.issue(subjectKey, claim);
  }
}
