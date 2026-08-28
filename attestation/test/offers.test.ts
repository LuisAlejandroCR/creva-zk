// offers.test.ts
// NoOffersProvider is the only OffersPort implementation and can never
// invent a rate or a lender — it always returns the same fixed,
// no-catalogue result.

import { describe, expect, it } from "vitest";
import { NoOffersProvider } from "../src/offers/noOffersProvider.js";

describe("NoOffersProvider", () => {
  it("always reports no_provider, never a rate or a lender", async () => {
    const offers = new NoOffersProvider();

    const result = await offers.getOffers();

    expect(result).toEqual({ available: false, error: "no_provider" });
    expect(result).not.toHaveProperty("rate");
    expect(result).not.toHaveProperty("lender");
  });

  it("is deterministic across calls", async () => {
    const offers = new NoOffersProvider();

    expect(await offers.getOffers()).toEqual(await offers.getOffers());
  });
});
