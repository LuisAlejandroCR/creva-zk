// proofScreen.spec.ts
// Unit tests for the shared proof view-model builder in
// src/screens/proofScreen.ts, covering all four rendered proof phases.

import { describe, expect, it } from 'vitest';
import { buildProofScreenContent } from '../../src/screens/proofScreen';

const base = {
  h1: 'Test screen',
  intro: 'intro text',
  readyHeading: (v: boolean) => `ready:${v}`,
  readyBody: (v: boolean) => `body:${v}`,
  failedBody: () => 'failed-body',
  degradedBody: () => 'degraded-body',
};

describe('buildProofScreenContent', () => {
  it('idle: offers a start action, enabled, not synthetic', () => {
    const content = buildProofScreenContent({ ...base, phase: 'idle', now: 0 });
    expect(content.ctaAction).toBe('start');
    expect(content.ctaDisabled).toBe(false);
    expect(content.synthetic).toBe(false);
  });

  it('generating: disables the action and reports elapsed time', () => {
    const content = buildProofScreenContent({ ...base, phase: 'generating', now: 12_400, startedAt: 1_000 });
    expect(content.ctaDisabled).toBe(true);
    expect(content.statusHeading).toContain('11 s transcurridos');
    expect(content.synthetic).toBe(false);
  });

  it('ready: offers continue and shows the settled value, marked synthetic', () => {
    const content = buildProofScreenContent({ ...base, phase: 'ready', now: 0, value: true });
    expect(content.ctaAction).toBe('continue');
    expect(content.statusHeading).toBe('ready:true');
    expect(content.synthetic).toBe(true);
  });

  it('failed: the predicate was evaluated and does not hold; offers retry', () => {
    const content = buildProofScreenContent({ ...base, phase: 'failed', now: 0 });
    expect(content.ctaAction).toBe('retry');
    expect(content.ctaDisabled).toBe(false);
    expect(content.statusBody).toBe('failed-body');
    expect(content.statusHeading.toLowerCase()).toContain('no se cumple');
  });

  it('degraded: needs no value, offers retry, and never reads as a rejection', () => {
    const content = buildProofScreenContent({ ...base, phase: 'degraded', now: 0 });
    expect(content.ctaAction).toBe('retry');
    expect(content.statusBody).toBe('degraded-body');
    expect(content.statusHeading.toLowerCase()).toContain('no pudimos');
    expect(content.synthetic).toBe(true);
  });

  it('throws if ready is reached without a settled value', () => {
    expect(() => buildProofScreenContent({ ...base, phase: 'ready', now: 0 })).toThrow();
  });
});
