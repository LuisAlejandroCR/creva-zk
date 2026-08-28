// malformed-backing-claim.fuzz.spec.ts
// The promise: no matter what collateral or threshold values are thrown
// at it, classifyBackingTier always terminates, always returns one of
// the four public tiers, and never grants a tier the collateral did not
// clear — including under malformed (out-of-order) threshold configs.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classifyBackingTier, type Tier, type TierThresholds } from "../support/circuitSpec.js";

const uint64 = () => fc.bigInt({ min: 0n, max: 2n ** 64n - 1n });
const thresholdsArb: fc.Arbitrary<TierThresholds> = fc.record({
  bronzeMin: uint64(),
  silverMin: uint64(),
  goldMin: uint64(),
});

const validTiers: Tier[] = ["NONE", "BRONZE", "SILVER", "GOLD"];

describe("classifyBackingTier under arbitrary and malformed inputs", () => {
  it("always returns one of the four public tiers", () => {
    fc.assert(
      fc.property(uint64(), thresholdsArb, (collateral, thresholds) => {
        const tier = classifyBackingTier(collateral, thresholds);
        expect(validTiers).toContain(tier);
      }),
    );
  });

  it("is monotonic: more collateral never drops the tier under fixed thresholds", () => {
    fc.assert(
      fc.property(uint64(), uint64(), thresholdsArb, (a, delta, thresholds) => {
        const higher = a + delta;
        const tierA = validTiers.indexOf(classifyBackingTier(a, thresholds));
        const tierHigher = validTiers.indexOf(classifyBackingTier(higher, thresholds));
        expect(tierHigher).toBeGreaterThanOrEqual(tierA);
      }),
    );
  });

  it("never grants gold or silver when collateral is below every threshold", () => {
    fc.assert(
      fc.property(thresholdsArb, ({ bronzeMin, silverMin, goldMin }) => {
        const belowAll = [bronzeMin, silverMin, goldMin].reduce((min, v) => (v < min ? v : min));
        fc.pre(belowAll > 0n);
        const tier = classifyBackingTier(belowAll - 1n, { bronzeMin, silverMin, goldMin });
        expect(tier).toBe("NONE");
      }),
    );
  });

  it("does not crash on adversarially out-of-order thresholds (silver below bronze, etc.)", () => {
    fc.assert(
      fc.property(uint64(), thresholdsArb, (collateral, thresholds) => {
        expect(() => classifyBackingTier(collateral, thresholds)).not.toThrow();
      }),
    );
  });
});
