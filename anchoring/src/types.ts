// anchoring/src/types.ts
// Domain types for the anchoring port. No chain SDK may be imported here —
// this module stays chain-agnostic; adapters/ hold the chain-specific code.

// The only outcome this system ever anchors. There is deliberately no
// equivalent type for the identity predicate: a public record of "this key
// was verified" is the linkable trail the product promises never to leave,
// so identity outcomes have no path into a Commitment.
export interface BackingOutcome {
  readonly tier: number;
  readonly timestamp: number; // unix seconds
}

// A commitment is the only thing that ever reaches an external chain: a
// hash of a BackingOutcome, never the outcome itself.
export interface Commitment {
  readonly hex: string; // sha256 digest, lowercase hex, no 0x prefix
}

export type ChainId = "cardano" | "evm";

export interface AnchorReceipt {
  readonly chain: ChainId;
  readonly commitment: Commitment;
  readonly txRef: string; // tx hash/id, chain-native format
  readonly anchoredAt: number; // unix seconds
}

// Fixed set of degraded reasons. A port never surfaces a raw provider error
// message here — that could carry internal detail (endpoints, stack
// fragments, account state). Raw errors go to a logger, not the result.
export type AnchorFailureReason = "provider_unavailable" | "invalid_response";

// A degraded result is the only failure mode a port may surface: never a
// thrown error, never a synthesized zero receipt.
export interface AnchorDegraded {
  readonly chain: ChainId;
  readonly reason: AnchorFailureReason;
}

export type AnchorResult =
  | { readonly status: "anchored"; readonly receipt: AnchorReceipt }
  | { readonly status: "degraded"; readonly degraded: AnchorDegraded };

// The port every chain adapter implements. Nothing moves between chains
// through this interface — each call anchors one commitment on one chain.
export interface AnchoringPort {
  readonly chain: ChainId;
  anchor(commitment: Commitment): Promise<AnchorResult>;
}
