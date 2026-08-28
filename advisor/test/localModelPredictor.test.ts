import { describe, expect, it, vi } from "vitest";
import { createLocalModelPredictor } from "../src/localModelPredictor.js";
import { LocalTierAdvisor } from "../src/localTierAdvisor.js";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

describe("createLocalModelPredictor", () => {
  it("uses the local model's recommendation when it is available", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ tier: "gold", offerAvailable: false, reason: "model says gold" }),
    );
    const predict = createLocalModelPredictor({ fetchImpl });
    const advisor = new LocalTierAdvisor(predict);

    const result = await advisor.advise({ tier: "gold" });

    expect(result).toEqual({
      status: "advised",
      recommendation: { tier: "gold", offerAvailable: false, reason: "model says gold" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the stub when the local model is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const predict = createLocalModelPredictor({ fetchImpl });
    const advisor = new LocalTierAdvisor(predict);

    const result = await advisor.advise({ tier: "silver" });

    expect(result.status).toEqual("advised");
    if (result.status === "advised") {
      expect(result.recommendation.tier).toEqual("silver");
      expect(result.recommendation.offerAvailable).toBe(false);
      expect(result.recommendation.reason.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the stub when the local model returns an untrusted or unknown-tier response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ tier: "platinum", offerAvailable: false, reason: "??" }));
    const predict = createLocalModelPredictor({ fetchImpl });
    const advisor = new LocalTierAdvisor(predict);

    const result = await advisor.advise({ tier: "bronze" });

    expect(result.status).toEqual("advised");
    if (result.status === "advised") {
      expect(result.recommendation.tier).toEqual("bronze");
      expect(result.recommendation).not.toHaveProperty("rate");
      expect(result.recommendation).not.toHaveProperty("lender");
    }
  });

  it("degrades through the advisor's own guard for a request tier the port never accepted", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ tier: "none", offerAvailable: false, reason: "unused" }),
    );
    const predict = createLocalModelPredictor({ fetchImpl });
    const advisor = new LocalTierAdvisor(predict);

    const result = await advisor.advise({ tier: "platinum" } as never);

    expect(result).toEqual({ status: "degraded", reason: "invalid_tier" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
