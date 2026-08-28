import { describe, expect, it } from "vitest";
import { commitBackingOutcome, verifyBackingCommitment } from "../src/commitment.js";

const outcome = { tier: 2, timestamp: 1_700_000_000 };

describe("commitBackingOutcome", () => {
  it("produces a 32-byte hex digest and a 32-byte hex blinding factor", () => {
    const { commitment, blinding } = commitBackingOutcome(outcome);
    expect(commitment.hex).toMatch(/^[0-9a-f]{64}$/);
    expect(blinding.hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is not brute-forceable: same outcome, different blinding, different commitment", () => {
    const a = commitBackingOutcome(outcome);
    const b = commitBackingOutcome({ ...outcome });
    expect(a.commitment.hex).not.toEqual(b.commitment.hex);
    expect(a.blinding.hex).not.toEqual(b.blinding.hex);
  });

  it("opens with the matching outcome and blinding factor", () => {
    const { commitment, blinding } = commitBackingOutcome(outcome);
    expect(verifyBackingCommitment(outcome, blinding, commitment)).toBe(true);
  });

  it("fails to open against the wrong tier", () => {
    const { commitment, blinding } = commitBackingOutcome(outcome);
    expect(verifyBackingCommitment({ ...outcome, tier: 3 }, blinding, commitment)).toBe(false);
  });

  it("fails to open against the wrong timestamp", () => {
    const { commitment, blinding } = commitBackingOutcome(outcome);
    expect(verifyBackingCommitment({ ...outcome, timestamp: outcome.timestamp + 1 }, blinding, commitment)).toBe(
      false,
    );
  });

  it("fails to open with the wrong blinding factor", () => {
    const { commitment } = commitBackingOutcome(outcome);
    const { blinding: otherBlinding } = commitBackingOutcome(outcome);
    expect(verifyBackingCommitment(outcome, otherBlinding, commitment)).toBe(false);
  });

  it.each([
    ["a NaN tier", { tier: Number.NaN, timestamp: 1_700_000_000 }],
    ["a float tier", { tier: 1.5, timestamp: 1_700_000_000 }],
    ["a negative tier", { tier: -1, timestamp: 1_700_000_000 }],
    ["a float timestamp", { tier: 1, timestamp: 1_700_000_000.5 }],
    ["a negative timestamp", { tier: 1, timestamp: -1 }],
    ["an unsafe integer timestamp", { tier: 1, timestamp: Number.MAX_SAFE_INTEGER + 10 }],
  ])("rejects %s instead of silently hashing it", (_label, badOutcome) => {
    expect(() => commitBackingOutcome(badOutcome)).toThrow(RangeError);
  });
});
