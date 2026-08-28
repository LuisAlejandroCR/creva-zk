// Domain types for the AI advisor (Integrate Midnight AI track).
//
// ============================================================================
// THE EXACT LIST OF FIELDS THE MODEL RECEIVES: `AdvisorInput.tier` only.
// ============================================================================
// The model never receives, directly or indirectly: the collateral amount,
// the account balance, any document, biometric data, or any other witness
// value from either ZK circuit. It receives the *derived* backing tier —
// the public outcome of the backing predicate — and nothing else. This is
// enforced by the type system: AdvisorInput has exactly one field, and
// AdvisorPort.advise is the only entry point into the model, so there is no
// path for a caller to smuggle additional data in.

// Stub of the tier the backing circuit derives. Defined here rather than
// imported from a shared `api` workspace, which does not exist yet.
export type Tier = "none" | "bronze" | "silver" | "gold";

const KNOWN_TIERS: ReadonlySet<string> = new Set<Tier>(["none", "bronze", "silver", "gold"]);

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && KNOWN_TIERS.has(value);
}

// The complete input surface of the advisor model. Adding a field here is
// the only way to widen what the model can see — and doing so must be
// deliberate and reviewed, since this type is the artifact that documents
// the privacy boundary.
export interface AdvisorInput {
  readonly tier: Tier;
}

// No `rate`, no `lender`, no numeric offer field exists on this type. No
// credit catalogue is connected to this repository, so the advisor cannot
// name a rate or a lender without inventing one — a false claim about the
// world. `offerAvailable` is always false until a catalogue exists;
// `reason` explains why, truthfully.
export interface Recommendation {
  readonly tier: Tier;
  readonly offerAvailable: false;
  readonly reason: string;
}

export type AdvisorFailureReason = "model_unavailable" | "invalid_tier" | "unsafe_model_endpoint";

export type AdvisorResult =
  | { readonly status: "advised"; readonly recommendation: Recommendation }
  | { readonly status: "degraded"; readonly reason: AdvisorFailureReason };

// The port the advisor is used through. A caller can never pass more than
// an AdvisorInput, so it can never pass more than a tier.
export interface AdvisorPort {
  advise(input: AdvisorInput): Promise<AdvisorResult>;
}
