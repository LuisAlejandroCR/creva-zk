// anchoring/src/adapters/evm.ts
// Anchors a commitment as the calldata of a zero-value EVM transaction behind
// the shared AnchoringPort. Exists to keep chain-specific submission — and the
// raw provider errors it can raise — out of the domain layer and out of results.

import type { AnchorFailureReason, AnchorReceipt, AnchorResult, AnchoringPort, Commitment } from "../types.js";

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

  constructor(
    private readonly submitter: EvmTxSubmitter,
    // Raw provider errors can carry internal detail (RPC endpoints, node
    // state); they are logged here, never placed in the returned result.
    private readonly logError: (error: unknown) => void = () => {},
  ) {}

  async anchor(commitment: Commitment): Promise<AnchorResult> {
    let response: { readonly txHash: string };
    try {
      response = await this.submitter.sendWithCalldata(`0x${commitment.hex}`);
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
