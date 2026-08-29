// anchoring/src/adapters/cardano.ts
// Anchors a commitment as Cardano transaction metadata behind the shared
// AnchoringPort. Exists to keep chain-specific submission — and the raw
// provider errors it can raise — out of the domain layer and out of results.

import type { AnchorFailureReason, AnchorReceipt, AnchorResult, AnchoringPort, Commitment } from "../types.js";

// Stub of what a real Cardano tx-submission client provides. No chain SDK
// dependency is wired in yet; this adapter is written against the shape one
// would expose, and a real client can be substituted without touching the
// port or the domain layer.
export interface CardanoTxSubmitter {
  // Submits a transaction carrying `metadataHex` as transaction metadata
  // (no contract deployed — Cardano already carries arbitrary bytes in a
  // tx's metadata, which is all an attestation anchor needs).
  submitMetadata(metadataHex: string): Promise<{ readonly txHash: string }>;
}

export class CardanoAnchorAdapter implements AnchoringPort {
  readonly chain = "cardano" as const;

  constructor(
    private readonly submitter: CardanoTxSubmitter,
    // Raw provider errors can carry internal detail (endpoints, node
    // state); they are logged here, never placed in the returned result.
    private readonly logError: (error: unknown) => void = () => {},
  ) {}

  async anchor(commitment: Commitment): Promise<AnchorResult> {
    let response: { readonly txHash: string };
    try {
      response = await this.submitter.submitMetadata(commitment.hex);
    } catch (error) {
      this.logError(error);
      return this.degraded("provider_unavailable");
    }

    if (!response.txHash) {
      return this.degraded("invalid_response");
    }

    const receipt: AnchorReceipt = {
      chain: this.chain,
      commitment,
      txRef: response.txHash,
      anchoredAt: Math.floor(Date.now() / 1000),
    };
    return { status: "anchored", receipt };
  }

  private degraded(reason: AnchorFailureReason): AnchorResult {
    return { status: "degraded", degraded: { chain: this.chain, reason } };
  }
}
