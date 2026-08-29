// api/src/types.ts
// Domain types for the api workspace: the degraded-result shapes every
// external step (environment start, provider wiring, deploy, circuit call)
// returns instead of throwing, plus the proof-latency measurement shape.

// Fixed set of degraded reasons. A step never surfaces a raw provider/SDK
// error message here — that could carry internal detail (endpoints, stack
// fragments, container state). Raw errors go to a logger, not the result.
export type ApiFailureReason =
  | "environment_unavailable" // local network/docker never came up
  | "wallet_unavailable" // genesis wallet failed to start or sync
  | "contract_not_compiled" // contract/src/managed/backing is missing
  | "deploy_failed"
  | "call_failed"
  // The four the browser-direct (Lace) path can distinguish before a proof
  // is even attempted. They are additive: no existing step produces them.
  | "wallet_absent" // no Midnight wallet is injected into this browser
  | "wallet_locked" // a wallet is there but handed back no usable connection
  | "wallet_wrong_network" // the wallet is connected to a different network
  | "proof_server_unreachable" // the user's local proof server never answered
  // The browser joins a contract deployed once from the CLI rather than
  // deploying one of its own, so "the build named no address" and "nothing
  // usable is at that address" are one precondition, and its own reason.
  | "contract_not_found";

export interface ApiDegraded {
  readonly step: string;
  readonly reason: ApiFailureReason;
}

export type ApiResult<T> =
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "degraded"; readonly degraded: ApiDegraded };

// One timed circuit call. `ms` is wall-clock time between the two marks
// placed immediately around the call, with nothing else — no human input,
// no unrelated I/O — between them.
export interface ProofLatency {
  readonly circuitId: string;
  readonly ms: number;
}

// The two outcomes proveBacking can produce for a given (collateral,
// requestedLimit) pair. All values here are synthetic demo data.
export interface BackingCheck {
  readonly label: string;
  readonly collateralAmount: bigint;
  readonly requestedLimit: bigint;
  readonly expectCleared: boolean;
}

export interface BackingCheckOutcome {
  readonly check: BackingCheck;
  readonly cleared: boolean;
  readonly answered: bigint;
  readonly latency: ProofLatency;
}

export type DemoReport =
  | {
      readonly status: "ok";
      readonly environmentColdStartMs: number;
      readonly deployMs: number;
      readonly outcomes: readonly BackingCheckOutcome[];
    }
  | { readonly status: "degraded"; readonly degraded: ApiDegraded };
