// proofState.ts
// The four-state proof lifecycle shared by the identity and backing screens,
// plus pure transition helpers so the reducer is testable without a DOM.
// `failed` and `degraded` are different answers and never collapse: failed
// means the predicate does not hold, degraded means nobody could check.

import type { ApiFailureReason } from '@creva-zk/api';
import { MEASURED_PROOF_MS } from './waitStages';

export type ProofPhase = 'idle' | 'generating' | 'ready' | 'failed' | 'degraded';

export interface ProofState<T> {
  readonly phase: ProofPhase;
  /** Only a `ready` proof has one: the disclosed outcome. */
  readonly value?: T;
  /** Only a `degraded` proof has one: why the answer never arrived. */
  readonly reason?: ApiFailureReason;
  readonly startedAt?: number;
}

export function idleProof<T>(): ProofState<T> {
  return { phase: 'idle' };
}

export function startGenerating<T>(now: number): ProofState<T> {
  return { phase: 'generating', startedAt: now };
}

export function settleReady<T>(value: T): ProofState<T> {
  return { phase: 'ready', value };
}

export function settleFailed<T>(): ProofState<T> {
  return { phase: 'failed' };
}

// No value: degraded means the external system never answered, so there is
// nothing to disclose. Carrying a value here would be inventing an outcome.
export function settleDegraded<T>(reason?: ApiFailureReason): ProofState<T> {
  return { phase: 'degraded', reason };
}

// The stub port answers instantly, which would reduce the wait screen to a
// flash. It is held for exactly the measured latency of one real proof, so
// the staged sequence on that screen is paced by the real thing instead of
// by an invented number. Only the stub source is held: a real proof takes as
// long as it takes and never has latency added to it.
export const STUB_LATENCY_MS = MEASURED_PROOF_MS;
