import type { AdvisorInput, AdvisorPort, AdvisorResult, Recommendation } from "./types.js";
import { isTier } from "./types.js";
import { createLocalModelPredictor } from "./localModelPredictor.js";

// Represents a call into a local inference process (e.g. a small model
// running on-device or in-cluster). Never a hosted/third-party API — no
// private financial data reaches this system in the first place, since the
// only thing that can be passed in is an AdvisorInput (a tier), but the
// "local, never hosted" constraint is also enforced at the call site: no
// implementation of this type may perform a network call to a hosted model
// provider.
export type LocalTierPredictor = (input: AdvisorInput) => Promise<Recommendation>;

// Default predictor: calls the real local model process and falls back to
// the deterministic stub table when it is unreachable or untrusted. Any
// other LocalTierPredictor can be substituted at construction time — the
// port and the privacy boundary above are unaffected either way.
const defaultPredictor: LocalTierPredictor = createLocalModelPredictor();

export class LocalTierAdvisor implements AdvisorPort {
  constructor(private readonly predict: LocalTierPredictor = defaultPredictor) {}

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
