import { describe, expect, it } from "vitest";
import { commitBackingOutcome } from "../src/commitment.js";

describe("commitBackingOutcome", () => {
  it("is deterministic for the same outcome", () => {
    const outcome = { tier: 2, timestamp: 1_700_000_000 };
    expect(commitBackingOutcome(outcome)).toEqual(commitBackingOutcome({ ...outcome }));
  });

  it("differs when the tier differs", () => {
    const a = commitBackingOutcome({ tier: 1, timestamp: 1_700_000_000 });
    const b = commitBackingOutcome({ tier: 2, timestamp: 1_700_000_000 });
    expect(a.hex).not.toEqual(b.hex);
  });

  it("differs when the timestamp differs", () => {
    const a = commitBackingOutcome({ tier: 1, timestamp: 1_700_000_000 });
    const b = commitBackingOutcome({ tier: 1, timestamp: 1_700_000_001 });
    expect(a.hex).not.toEqual(b.hex);
  });

  it("never carries the raw outcome, only a hex digest", () => {
    const commitment = commitBackingOutcome({ tier: 3, timestamp: 1_700_000_000 });
    expect(commitment.hex).toMatch(/^[0-9a-f]{64}$/);
  });
});
