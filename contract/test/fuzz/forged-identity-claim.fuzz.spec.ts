// forged-identity-claim.fuzz.spec.ts
// The promise: across every random combination of claim fields, the
// identity check is true in exactly one case — verified, of age, and a
// tax ID that matches — and a forger changing any single field flips it
// to false.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkIdentity } from "../support/circuitSpec.js";

const EXPECTED_HASH = "sha256:expected";
const hashArb = fc.oneof(fc.constant(EXPECTED_HASH), fc.string({ minLength: 1, maxLength: 32 }));

describe("checkIdentity against arbitrary and forged claims", () => {
  it("is true iff verified && ofAge && taxId matches the expected hash", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), hashArb, (verified, ofAge, taxId) => {
        const expected = verified && ofAge && taxId === EXPECTED_HASH;
        expect(checkIdentity({ verified, ofAge, taxId }, EXPECTED_HASH)).toBe(expected);
      }),
    );
  });

  it("a forger who only forges the tax ID hash never passes without the real one", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s !== EXPECTED_HASH),
        (forgedTaxId) => {
          expect(checkIdentity({ verified: true, ofAge: true, taxId: forgedTaxId }, EXPECTED_HASH)).toBe(false);
        },
      ),
    );
  });

  it("flipping any single field of a passing claim makes it fail", () => {
    const passing = { verified: true, ofAge: true, taxId: EXPECTED_HASH };
    expect(checkIdentity({ ...passing, verified: false }, EXPECTED_HASH)).toBe(false);
    expect(checkIdentity({ ...passing, ofAge: false }, EXPECTED_HASH)).toBe(false);
    expect(checkIdentity({ ...passing, taxId: "anything-else" }, EXPECTED_HASH)).toBe(false);
  });
});
