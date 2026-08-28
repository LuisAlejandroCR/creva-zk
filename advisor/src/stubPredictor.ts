import type { Recommendation, Tier } from "./types.js";
import type { LocalTierPredictor } from "./localTierAdvisor.js";

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

// Deterministic rule table used both as the advisor's fallback when the
// local model is unavailable, and as a standalone predictor for tests.
export const stubPredictor: LocalTierPredictor = async (input) => GUIDANCE[input.tier];
