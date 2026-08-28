// types.ts
// Domain types for the offers port. `available` is fixed at `false` in
// the type itself — no lender catalogue is connected to this repository,
// so there is no shape in which this port could report a rate or a
// lender without inventing one, which would be a false claim about the
// world.

export interface OfferResult {
  readonly available: false;
  readonly error: "no_provider";
}

export interface OffersPort {
  getOffers(): Promise<OfferResult>;
}
