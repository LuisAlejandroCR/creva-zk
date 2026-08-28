// noOffersProvider.ts
// The only implementation OffersPort will ever have until a real lender
// catalogue is connected: zero adapters, because there is nothing to wire
// in and nothing to fall back from. It cannot degrade — there is no
// provider call to fail — so it always returns the same fixed result.

import type { OffersPort, OfferResult } from "./types.js";

const NO_PROVIDER: OfferResult = { available: false, error: "no_provider" };

export class NoOffersProvider implements OffersPort {
  async getOffers(): Promise<OfferResult> {
    return NO_PROVIDER;
  }
}
