// syntheticBackingIssuer.ts
// The fallback backing issuer used only while Creva's API is degraded (see
// crevaAwareBackingIssuer.ts). Signs the same Attestation<CollateralClaim>
// shape CrevaCollateralSigner does, through the same signer abstraction the
// identity issuer uses, so the demo flow keeps running end to end without
// Creva's API — never by inventing a collateral figure, only by attesting
// to whatever collateral value the caller supplies.

import type { AttestationSigner } from "../signing.js";
import type { JubjubPoint, SignedPayload, IssuerResult } from "../types.js";
import type { CollateralClaim, BackingIssuerPort } from "./types.js";

export class SyntheticBackingIssuer implements BackingIssuerPort {
  // Required, with no default — see SyntheticIdentityIssuer for why a
  // default signer would be a liability rather than a convenience.
  constructor(
    private readonly signer: AttestationSigner<CollateralClaim>,
    private readonly logError: (error: unknown) => void = () => {},
  ) {}

  async issue(subjectKey: JubjubPoint, claim: CollateralClaim): Promise<IssuerResult<CollateralClaim>> {
    const payload: SignedPayload<CollateralClaim> = { subjectKey, claim };
    try {
      const signature = await this.signer.sign(payload);
      return {
        status: "issued",
        issued: { origin: "synthetic", attestation: { payload, signature } },
      };
    } catch (error) {
      this.logError(error);
      return { status: "degraded", reason: "signer_unavailable" };
    }
  }
}
