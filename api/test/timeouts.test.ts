// api/test/timeouts.test.ts
// Checks the one bounded-wait helper every external step shares: it hands
// back the work's own value when the work answers, it gives up at exactly
// the budget when the work never answers at all, and the promise it walked
// away from never surfaces as an unhandled rejection.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_JOIN_TIMEOUT_MS,
  DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS,
  DEFAULT_WALLET_CONNECT_TIMEOUT_MS,
  DEFAULT_WALLET_QUERY_TIMEOUT_MS,
  TIMED_OUT,
  withTimeout,
} from "../src/timeouts.js";

// The case the whole module exists for: not a promise that rejects, one
// that never settles. A wallet dialog nobody answers behaves like this.
function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

// Records how a promise ended without ever awaiting it, so a test can ask
// "has it settled yet?" at a chosen point on the fake clock.
function track<T>(promise: Promise<T>): { settled: boolean; value?: T } {
  const state: { settled: boolean; value?: T } = { settled: false };
  void promise.then((value) => {
    state.settled = true;
    state.value = value;
  });
  return state;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("hands back the work's own value when the work answers first", async () => {
    await expect(withTimeout(Promise.resolve("answered"), 1_000)).resolves.toBe("answered");
  });

  it("lets the work's rejection through when the work rejects first", async () => {
    await expect(withTimeout(Promise.reject(new Error("refused")), 1_000)).rejects.toThrow("refused");
  });

  it("gives up at the budget, and not one tick before it", async () => {
    vi.useFakeTimers();
    const state = track(withTimeout(never<string>(), 5_000));

    await vi.advanceTimersByTimeAsync(4_999);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.settled).toBe(true);
    expect(state.value).toBe(TIMED_OUT);
  });

  it("swallows the losing promise's rejection instead of leaving it unhandled", async () => {
    vi.useFakeTimers();
    let rejectLoser: (error: Error) => void = () => undefined;
    const loser = new Promise<string>((_resolve, reject) => {
      rejectLoser = reject;
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown): void => {
      unhandled.push(error);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const raced = withTimeout(loser, 1_000);
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(raced).resolves.toBe(TIMED_OUT);

      // The work carries on after the race is lost and then fails, which is
      // exactly the case that used to crash the page.
      rejectLoser(new Error("answered far too late, and badly"));
      vi.useRealTimers();
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("clears its own timer, so a bounded wait never holds the process open", async () => {
    vi.useFakeTimers();
    await withTimeout(Promise.resolve(1), 60_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("the budgets themselves", () => {
  it("gives the dialog a human has to read far more room than a network call", () => {
    // The justification in timeouts.ts, as an assertion: a person reading a
    // permission prompt must never be cut off before a machine would be.
    expect(DEFAULT_WALLET_CONNECT_TIMEOUT_MS).toBeGreaterThan(DEFAULT_WALLET_QUERY_TIMEOUT_MS);
    expect(DEFAULT_WALLET_QUERY_TIMEOUT_MS).toBeGreaterThan(DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS);
  });

  it("keeps every budget far below the ~23.7s a real proof takes, except the dialog", () => {
    // Reaching the proof server is bounded; the proof is not, so nothing
    // here may be so long that a failure outlasts the work it guards.
    expect(DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS).toBeLessThan(23_700);
    expect(DEFAULT_WALLET_QUERY_TIMEOUT_MS).toBeLessThan(23_700);
    expect(DEFAULT_JOIN_TIMEOUT_MS).toBeLessThan(23_700);
  });
});
