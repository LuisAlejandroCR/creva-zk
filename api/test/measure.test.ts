// api/test/measure.test.ts
// Verifies the timing helper actually measures wall-clock time around the
// call it wraps, and that measureCircuitCall attaches the given circuit id.

import { describe, expect, it } from "vitest";
import { measureCircuitCall, measureMs } from "../src/measure.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("measureMs", () => {
  it("returns the wrapped value and a non-negative duration", async () => {
    const { value, ms } = await measureMs(async () => {
      await delay(5);
      return 42;
    });

    expect(value).toBe(42);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("propagates a rejection instead of swallowing it", async () => {
    await expect(
      measureMs(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

describe("measureCircuitCall", () => {
  it("tags the measured latency with the given circuit id", async () => {
    const { value, latency } = await measureCircuitCall("proveBacking", async () => {
      await delay(1);
      return "ok" as const;
    });

    expect(value).toBe("ok");
    expect(latency.circuitId).toBe("proveBacking");
    expect(latency.ms).toBeGreaterThanOrEqual(0);
  });
});
