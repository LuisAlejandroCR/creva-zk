// api/src/measure.ts
// Wall-clock timing helper. The one rule that matters: the two marks it
// places go immediately around the timed call, with no human input and no
// unrelated await between them.

import type { ProofLatency } from "./types.js";

export async function measureMs<T>(fn: () => Promise<T>): Promise<{ readonly value: T; readonly ms: number }> {
  const start = performance.now();
  const value = await fn();
  const ms = performance.now() - start;
  return { value, ms };
}

export async function measureCircuitCall<T>(
  circuitId: string,
  fn: () => Promise<T>,
): Promise<{ readonly value: T; readonly latency: ProofLatency }> {
  const { value, ms } = await measureMs(fn);
  return { value, latency: { circuitId, ms } };
}
