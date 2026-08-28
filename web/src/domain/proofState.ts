// proofState.ts
// The four-state proof lifecycle shared by the identity and backing screens,
// plus pure transition helpers so the reducer is testable without a DOM.

export type ProofPhase = 'idle' | 'generating' | 'ready' | 'failed' | 'degraded';

export interface ProofState<T> {
  readonly phase: ProofPhase;
  readonly value?: T;
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

export function settleDegraded<T>(value: T): ProofState<T> {
  return { phase: 'degraded', value };
}

// Real proofs here take tens of seconds; this is the simulated duration the
// stub uses before settling, so the "generating" screen is not a flash.
export const GENERATING_DURATION_MS = 32_000;

export function formatElapsed(startedAt: number, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${elapsedSeconds} s transcurridos`;
}
