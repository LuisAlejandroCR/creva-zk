// crevaCollateralSigner.ts
// The real backing issuer: signs a collateral claim through Creva's own
// signing service, over Creva's own key. Unlike the identity issuer, this
// signature is real — Creva's collateral ledger is still connected, only
// its KYC provider disconnected.

import type { CollateralClaim, BackingIssuerPort } from "./types.js";
import type { JubjubPoint, SchnorrSignature, SignedPayload, IssuerResult } from "../types.js";

// Stub of what a real Creva signing-service client provides — no HTTP
// client is wired in yet; this adapter is written against the shape one
// would expose, and a real client can be substituted without touching the
// port or the domain layer. Mirrors anchoring's EvmTxSubmitter /
// CardanoTxSubmitter stubs.
export interface CrevaSigningClient {
  signCollateralClaim(payload: SignedPayload<CollateralClaim>): Promise<{ readonly signature: SchnorrSignature }>;
}

export class CrevaCollateralSigner implements BackingIssuerPort {
  constructor(
    private readonly client: CrevaSigningClient,
    // Raw provider errors can carry internal detail (endpoints, account
    // state); they are logged here, never placed in the returned result.
    private readonly logError: (error: unknown) => void = () => {},
  ) {}

  async issue(subjectKey: JubjubPoint, claim: CollateralClaim): Promise<IssuerResult<CollateralClaim>> {
    const payload: SignedPayload<CollateralClaim> = { subjectKey, claim };
    let response: { readonly signature: SchnorrSignature };
    try {
      response = await this.client.signCollateralClaim(payload);
    } catch (error) {
      this.logError(error);
      return { status: "degraded", reason: "signer_unavailable" };
    }

    return {
      status: "issued",
      issued: { origin: "creva", attestation: { payload, signature: response.signature } },
    };
  }
}
