// proofRun.ts
// Runs one proof and reports every state it passes through. Kept free of the
// DOM and of real timers so the ordering guarantee — generating is entered
// before the call and left only after it — is testable directly.

import type { ApiResult } from '@creva-zk/api';
import type { ProofState } from './domain/proofState';
import { settleDegraded, startGenerating } from './domain/proofState';
import { toProofState } from './proofPort';

export interface RunProofOptions<T> {
  /** The port call. Assumed to be able to take tens of seconds. */
  readonly call: () => Promise<ApiResult<T>>;
  /** Whether an `ok` outcome means the predicate holds. */
  readonly holds: (value: T) => boolean;
  /** Every state the proof passes through, in order. */
  readonly emit: (state: ProofState<T>) => void;
  /** Held for this long on top of the call, so an instant stub still shows
   *  the generating screen. Zero for a real proof. */
  readonly minimumMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runProof<T>(options: RunProofOptions<T>): Promise<ProofState<T>> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const minimumMs = options.minimumMs ?? 0;

  const startedAt = now();
  // Generating is entered before the call, never alongside it: a 23.7s proof
  // has to render as a screen from the first millisecond, not as a button
  // that stops responding.
  options.emit(startGenerating<T>(startedAt));

  let settled: ProofState<T>;
  try {
    const result = await options.call();
    settled = toProofState(result, options.holds);
  } catch {
    // A port is contracted to return a degraded result rather than throw, so
    // reaching here means one broke that contract. Treat it as what it is —
    // no answer came back — instead of letting it reach the screen as an
    // unhandled rejection.
    settled = settleDegraded<T>('call_failed');
  }

  const elapsed = now() - startedAt;
  if (minimumMs > elapsed) {
    await sleep(minimumMs - elapsed);
  }

  // Left only after the call has settled.
  options.emit(settled);
  return settled;
}
