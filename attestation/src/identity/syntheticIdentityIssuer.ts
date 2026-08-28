// syntheticIdentityIssuer.ts
// The demo identity issuer. Signs the exact same Attestation<IdentityClaim>
// shape a real KYC provider would, through the exact same
// verifyAttestation circuit path — the only difference from a real issuer
// is the `origin: "synthetic"` tag on the result, which a UI reads to
// label the claim on screen. No special-cased verification, no shortcut
// proof: the flow is honest because nothing downstream can tell the
// difference except that one tag.

import type { AttestationSigner } from "../signing.js";
import { Ed25519AttestationSigner } from "../signing.js";
import type { JubjubPoint, SignedPayload, IssuerResult } from "../types.js";
import type { IdentityClaim, IdentityIssuerPort } from "./types.js";

export class SyntheticIdentityIssuer implements IdentityIssuerPort {
  constructor(
    private readonly signer: AttestationSigner = new Ed25519AttestationSigner(),
    // Raw signer errors can carry internal detail (key material, process
    // state); they are logged here, never placed in the returned result.
    private readonly logError: (error: unknown) => void = () => {},
  ) {}

  async issue(subjectKey: JubjubPoint, claim: IdentityClaim): Promise<IssuerResult<IdentityClaim>> {
    const payload: SignedPayload<IdentityClaim> = { subjectKey, claim };
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
