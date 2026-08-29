// anchoring/src/index.ts
// Public surface of the anchoring workspace: the chain-agnostic types, the
// commitment functions, and the two chain adapters. Consumers import from here
// so no caller reaches into adapters/ directly.

export type {
  AnchorDegraded,
  AnchorFailureReason,
  AnchorReceipt,
  AnchorResult,
  AnchoringPort,
  BackingOutcome,
  ChainId,
  Commitment,
} from "./types.js";
export {
  commitBackingOutcome,
  verifyBackingCommitment,
  type Blinding,
  type CommitmentWithBlinding,
} from "./commitment.js";
export { CardanoAnchorAdapter, type CardanoTxSubmitter } from "./adapters/cardano.js";
export { EvmAnchorAdapter, type EvmTxSubmitter } from "./adapters/evm.js";
