// proofState.spec.ts
// Unit tests for the proof lifecycle reducer helpers in
// src/domain/proofState.ts. The elapsed-time readout moved to
// domain/waitStages.ts, which owns the wait screen's whole sequence.

import { describe, expect, it } from 'vitest';
import {
  idleProof,
  settleDegraded,
  settleFailed,
  settleReady,
  startGenerating,
} from '../../src/domain/proofState';

describe('proof state transitions', () => {
  it('starts idle with no value or start time', () => {
    const state = idleProof<boolean>();
    expect(state.phase).toBe('idle');
    expect(state.value).toBeUndefined();
    expect(state.startedAt).toBeUndefined();
  });

  it('startGenerating records the start time and no value yet', () => {
    const state = startGenerating<boolean>(1000);
    expect(state.phase).toBe('generating');
    expect(state.startedAt).toBe(1000);
    expect(state.value).toBeUndefined();
  });

  it('settleReady carries the settled value', () => {
    const state = settleReady('gold');
    expect(state.phase).toBe('ready');
    expect(state.value).toBe('gold');
  });

  it('settleFailed carries no value', () => {
    const state = settleFailed<boolean>();
    expect(state.phase).toBe('failed');
    expect(state.value).toBeUndefined();
  });

  it('settleDegraded carries a reason and never a value', () => {
    const state = settleDegraded('call_failed');
    expect(state.phase).toBe('degraded');
    expect(state.reason).toBe('call_failed');
    // Degraded means nobody answered, so there is no outcome to disclose.
    expect(state.value).toBeUndefined();
  });
});
