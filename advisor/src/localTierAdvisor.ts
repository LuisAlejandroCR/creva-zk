import type { AdvisorInput, AdvisorPort, AdvisorResult, Recommendation, Tier } from "./types.js";
import { isTier } from "./types.js";

// Guidance text only, keyed by tier — never a rate, never a lender name.
// No credit catalogue is connected to this repository; inventing either
// would be a false claim about the world, so `offerAvailable` stays false
// everywhere and `reason` says why.
const GUIDANCE: Readonly<Record<Tier, Recommendation>> = {
  none: {
    tier: "none",
    offerAvailable: false,
    reason: "Collateral did not clear the requested limit. No offer available.",
  },
  bronze: {
    tier: "bronze",
    offerAvailable: false,
    reason: "Qualifies for the bronze tier. No lender catalogue is connected — no offer available yet.",
  },
  silver: {
    tier: "silver",
    offerAvailable: false,
    reason: "Qualifies for the silver tier. No lender catalogue is connected — no offer available yet.",
  },
  gold: {
    tier: "gold",
    offerAvailable: false,
    reason: "Qualifies for the gold tier. No lender catalogue is connected — no offer available yet.",
  },
};

// Represents a call into a local inference process (e.g. a small model
// running on-device or in-cluster). Never a hosted/third-party API — no
// private financial data reaches this system in the first place, since the
// only thing that can be passed in is an AdvisorInput (a tier), but the
// "local, never hosted" constraint is also enforced at the call site: no
// implementation of this type may perform a network call to a hosted model
// provider.
export type LocalTierPredictor = (input: AdvisorInput) => Promise<Recommendation>;

// Default predictor: a deterministic rule table, i.e. the "typed stub"
// this module ships with in place of a wired-up local model. Swapping in a
// real local model means providing a different LocalTierPredictor — the
// port and the privacy boundary above are unaffected either way.
const stubPredictor: LocalTierPredictor = async (input) => GUIDANCE[input.tier];

export class LocalTierAdvisor implements AdvisorPort {
  constructor(private readonly predict: LocalTierPredictor = stubPredictor) {}

  async advise(input: AdvisorInput): Promise<AdvisorResult> {
    if (!isTier(input.tier)) {
      return { status: "degraded", reason: "invalid_tier" };
    }

    try {
      const recommendation = await this.predict({ tier: input.tier });
      return { status: "advised", recommendation };
    } catch {
      // Never a 500, never a fabricated recommendation: an unavailable
      // model degrades to a typed result the caller must handle.
      return { status: "degraded", reason: "model_unavailable" };
    }
  }
}
