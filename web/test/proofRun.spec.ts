// proofRun.spec.ts
// Proves the two guarantees the seam wiring exists for: the generating state
// is entered before the port call and left only after it settles, and a port
// that cannot reach its server lands on degraded rather than hanging,
// blanking, or throwing at the caller.

import { describe, expect, it, vi } from 'vitest';
import { createBridgeBackingPort, createBridgeIdentityPort } from '@creva-zk/api';
import type { ApiResult } from '@creva-zk/api';
import type { Tier } from '../src/domain/tier';
import type { ProofState } from '../src/domain/proofState';
import { runProof } from '../src/proofRun';
import {
  SYNTHETIC_ISSUER_KEY,
  SYNTHETIC_REQUESTED_LIMIT,
  SYNTHETIC_TAX_ID_HASH,
  backingHolds,
  identityHolds,
} from '../src/domain/demoInputs';
import { buildBackingContent } from '../src/screens/backingContent';

// No timers are faked here: `sleep` is injected, so a 32s hold costs nothing.
const noSleep = async (): Promise<void> => {};

describe('generating is a state, not a frozen button', () => {
  it('emits generating before the call resolves and settles only after', async () => {
    const order: string[] = [];
    let releaseCall: (result: ApiResult<Tier>) => void = () => {};
    const call = (): Promise<ApiResult<Tier>> =>
      new Promise<ApiResult<Tier>>((resolve) => {
        releaseCall = resolve;
      });

    const states: Array<ProofState<Tier>> = [];
    const run = runProof<Tier>({
      call: () => {
        order.push('call-started');
        return call();
      },
      holds: backingHolds,
      emit: (state) => {
        order.push(`emit:${state.phase}`);
        states.push(state);
      },
      sleep: noSleep,
    });

    // Let the generating emit and the call start, then assert that the
    // screen is already showing generating while the call is still in flight.
    await Promise.resolve();
    expect(states.map((s) => s.phase)).toEqual(['generating']);
    expect(order).toEqual(['emit:generating', 'call-started']);

    releaseCall({ status: 'ok', value: 'silver' });
    await run;

    expect(states.map((s) => s.phase)).toEqual(['generating', 'ready']);
    expect(order[order.length - 1]).toBe('emit:ready');
  });

  it('stamps the generating state with a start time the elapsed readout can use', async () => {
    const states: Array<ProofState<Tier>> = [];
    await runProof<Tier>({
      call: async () => ({ status: 'ok', value: 'silver' }),
      holds: backingHolds,
      emit: (state) => states.push(state),
      now: () => 1_000,
      sleep: noSleep,
    });

    expect(states[0]?.startedAt).toBe(1_000);
  });

  it('holds the stub for its full simulated latency, and no longer', async () => {
    const slept: number[] = [];
    let clock = 0;

    await runProof<Tier>({
      call: async () => ({ status: 'ok', value: 'silver' }),
      holds: backingHolds,
      emit: () => {},
      minimumMs: 32_000,
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    });

    expect(slept).toEqual([32_000]);
  });

  it('adds no latency to a call that already took longer than the hold', async () => {
    const slept: number[] = [];
    let clock = 0;

    await runProof<Tier>({
      call: async () => {
        clock += 23_700; // a real proof, measured
        return { status: 'ok', value: 'silver' };
      },
      holds: backingHolds,
      emit: () => {},
      minimumMs: 0, // real and bridge sources get no hold at all
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    });

    expect(slept).toEqual([]);
  });
});

describe('the bridge source with the proof server down', () => {
  // What a browser sees when nothing is listening on the bridge's port.
  const serverDown = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;

  it('lands the backing screen on degraded, never on a hang or a blank', async () => {
    const states: Array<ProofState<Tier>> = [];
    const port = createBridgeBackingPort({ fetchImpl: serverDown });

    const settled = await runProof<Tier>({
      call: () => port.checkBacking(SYNTHETIC_REQUESTED_LIMIT),
      holds: backingHolds,
      emit: (state) => states.push(state),
      sleep: noSleep,
    });

    expect(states.map((s) => s.phase)).toEqual(['generating', 'degraded']);
    expect(settled.reason).toBe('call_failed');
    // No outcome was invented to fill the gap.
    expect(settled.value).toBeUndefined();

    // And it reaches the screen as "we could not check", offering retry.
    const content = buildBackingContent(settled, Date.now());
    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
    expect(content.title).toContain('No pudimos terminar la revisión');
  });

  it('lands the identity screen on degraded too', async () => {
    const states: Array<ProofState<boolean>> = [];
    const port = createBridgeIdentityPort({ fetchImpl: serverDown });

    await runProof<boolean>({
      call: () => port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH),
      holds: identityHolds,
      emit: (state) => states.push(state),
      sleep: noSleep,
    });

    expect(states.map((s) => s.phase)).toEqual(['generating', 'degraded']);
  });

  it('degrades rather than rejecting even if a port breaks its no-throw contract', async () => {
    const states: Array<ProofState<Tier>> = [];

    const settled = await runProof<Tier>({
      call: async () => {
        throw new Error('a port that should never throw, threw');
      },
      holds: backingHolds,
      emit: (state) => states.push(state),
      sleep: noSleep,
    });

    expect(states.map((s) => s.phase)).toEqual(['generating', 'degraded']);
    expect(settled.reason).toBe('call_failed');
  });
});
