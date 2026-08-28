import type { AnchorReceipt, AnchorResult, AnchoringPort, Commitment } from "../types.js";

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

  constructor(private readonly submitter: CardanoTxSubmitter) {}

  async anchor(commitment: Commitment): Promise<AnchorResult> {
    try {
      const { txHash } = await this.submitter.submitMetadata(commitment.hex);
      const receipt: AnchorReceipt = {
        chain: this.chain,
        commitment,
        txRef: txHash,
        anchoredAt: Math.floor(Date.now() / 1000),
      };
      return { status: "anchored", receipt };
    } catch (error) {
      return {
        status: "degraded",
        degraded: {
          chain: this.chain,
          reason: error instanceof Error ? error.message : "cardano provider unavailable",
        },
      };
    }
  }
}
