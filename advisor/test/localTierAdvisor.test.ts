import { describe, expect, it, vi } from "vitest";
import { LocalTierAdvisor, type LocalTierPredictor } from "../src/localTierAdvisor.js";
import type { AdvisorInput, Tier } from "../src/types.js";

describe("LocalTierAdvisor", () => {
  it.each<Tier>(["none", "bronze", "silver", "gold"])("advises for tier %s without inventing an offer", async (tier) => {
    const advisor = new LocalTierAdvisor();

    const result = await advisor.advise({ tier });

    expect(result.status).toEqual("advised");
    if (result.status === "advised") {
      expect(result.recommendation.tier).toEqual(tier);
      expect(result.recommendation.offerAvailable).toBe(false);
      expect(result.recommendation.reason.length).toBeGreaterThan(0);
      expect(result.recommendation).not.toHaveProperty("rate");
      expect(result.recommendation).not.toHaveProperty("lender");
    }
  });

  it("passes the model only the tier field, nothing else", async () => {
    const predict = vi.fn<LocalTierPredictor>(async (input) => ({
      tier: input.tier,
      offerAvailable: false,
      reason: "stub",
    }));
    const advisor = new LocalTierAdvisor(predict);

    await advisor.advise({ tier: "silver" } as AdvisorInput);

    expect(predict).toHaveBeenCalledTimes(1);
    const received = predict.mock.calls[0]![0];
    expect(Object.keys(received)).toEqual(["tier"]);
    expect(received.tier).toEqual("silver");
  });

  it("degrades instead of throwing when the model is unavailable", async () => {
    const predict: LocalTierPredictor = async () => {
      throw new Error("local inference process not running");
    };
    const advisor = new LocalTierAdvisor(predict);

    const result = await advisor.advise({ tier: "gold" });

    expect(result).toEqual({ status: "degraded", reason: "model_unavailable" });
  });

  it("degrades instead of fabricating a recommendation for an unknown tier", async () => {
    const advisor = new LocalTierAdvisor();

    const result = await advisor.advise({ tier: "platinum" } as unknown as AdvisorInput);

    expect(result).toEqual({ status: "degraded", reason: "invalid_tier" });
  });
});
