import type { AnchorReceipt, AnchorResult, AnchoringPort, Commitment } from "../types.js";

// Stub of what a real EVM tx-submission client provides. No chain SDK
// dependency is wired in yet; this adapter is written against the shape one
// would expose, and a real client (viem, ethers, ...) can be substituted
// without touching the port or the domain layer.
export interface EvmTxSubmitter {
  // Sends a zero-value transaction carrying `calldataHex` (0x-prefixed) as
  // its input data — no contract deployed, calldata alone is the anchor.
  sendWithCalldata(calldataHex: string): Promise<{ readonly txHash: string }>;
}

export class EvmAnchorAdapter implements AnchoringPort {
  readonly chain = "evm" as const;

  constructor(private readonly submitter: EvmTxSubmitter) {}

  async anchor(commitment: Commitment): Promise<AnchorResult> {
    try {
      const { txHash } = await this.submitter.sendWithCalldata(`0x${commitment.hex}`);
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
          reason: error instanceof Error ? error.message : "evm provider unavailable",
        },
      };
    }
  }
}
