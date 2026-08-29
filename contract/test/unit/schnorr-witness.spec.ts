// schnorr-witness.spec.ts
// The promise: getSchnorrReduction returns the exact (quotient,
// remainder) pair schnorr.compact's two asserts check — so a proof over a
// real signature reduces the challenge instead of aborting on it.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MAX_QUOTIENT,
  TWO_248,
  getSchnorrReduction,
  schnorrReduction,
} from "../../src/schnorrWitness.js";
import { readCompactSource } from "../support/circuitSpec.js";

// One less than the BLS12-381 scalar prime: the largest value
// transientHash can return, and so the largest challenge the witness can
// ever be handed.
const MAX_FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184512n;

describe("schnorrReduction", () => {
  it("satisfies the reduction equation the circuit asserts", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: MAX_FIELD }), (challengeHash) => {
        const [quotient, remainder] = schnorrReduction(challengeHash);
        expect(quotient * TWO_248 + remainder).toEqual(challengeHash);
      }),
    );
  });

  it("keeps the remainder inside Uint<248>, as the witness signature requires", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: MAX_FIELD }), (challengeHash) => {
        const [, remainder] = schnorrReduction(challengeHash);
        expect(remainder).toBeGreaterThanOrEqual(0n);
        expect(remainder).toBeLessThan(TWO_248);
      }),
    );
  });

  it("never exceeds the quotient bound the circuit enforces", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: MAX_FIELD }), (challengeHash) => {
        const [quotient] = schnorrReduction(challengeHash);
        expect(quotient).toBeLessThan(MAX_QUOTIENT);
      }),
    );
  });

  it("produces the largest legal quotient at the top of the field", () => {
    // The circuit's `q < 116` bound is only correct if the maximum real
    // quotient is 115; a bound off by one would reject honest signatures.
    expect(schnorrReduction(MAX_FIELD)[0]).toEqual(MAX_QUOTIENT - 1n);
  });
});

describe("getSchnorrReduction witness", () => {
  it("returns the private state untouched alongside the reduction", () => {
    const privateState = { untouched: true };

    const [nextState, reduction] = getSchnorrReduction(
      { privateState } as never,
      TWO_248 * 7n + 12345n,
    );

    expect(nextState).toBe(privateState);
    expect(reduction).toEqual([7n, 12345n]);
  });
});

describe("schnorr.compact's own constants", () => {
  const source = readCompactSource("schnorr.compact");

  it("divides by the same 2^248 this witness does", () => {
    expect(source).toContain(TWO_248.toString());
  });

  it("bounds the quotient by the same value this witness guarantees", () => {
    expect(source).toMatch(new RegExp(`disclose\\(q\\) < ${MAX_QUOTIENT}`));
  });
});
