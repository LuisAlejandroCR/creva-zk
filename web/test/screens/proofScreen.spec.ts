// proofScreen.spec.ts
// Unit tests for the shared proof view-model builder in
// src/screens/proofScreen.ts. Each proof phase must resolve to the archetype
// that state belongs in — an invitation, work in flight, an answer, or a way
// forward — and carry only the components that state actually needs.

import { describe, expect, it } from 'vitest';
import { buildProofScreenContent } from '../../src/screens/proofScreen';

const base = {
  introTitle: 'intro-title',
  introLede: 'intro-lede',
  verifyingTitle: 'verifying-title',
  startLabel: 'start-label',
  continueLabel: 'continue-label',
  stages: [
    { label: 'stage-one', detail: 'detail-one', startFraction: 0 },
    { label: 'stage-two', detail: 'detail-two', startFraction: 0.5 },
  ],
  readyTitle: (v: boolean) => `ready:${v}`,
  readyLede: (v: boolean) => `lede:${v}`,
  readyBody: (v: boolean) => `body:${v}`,
  failedTitle: 'Todavía no se puede',
  failedBody: () => 'failed-body',
  degradedBody: () => 'degraded-body',
  help: 'privacidad/que-ve-creva',
};

describe('buildProofScreenContent', () => {
  it('idle: the intro archetype — one headline, one action, no status card', () => {
    const content = buildProofScreenContent({ ...base, phase: 'idle', now: 0 });
    expect(content.archetype).toBe('intro');
    expect(content.title).toBe('intro-title');
    expect(content.ctaAction).toBe('start');
    expect(content.ctaLabel).toBe('start-label');
    expect(content.ctaDisabled).toBe(false);
    expect(content.synthetic).toBe(false);
    expect(content.askWhy).toBe(false);
    // Nothing has been answered, so there is nothing to state.
    expect(content.body).toBeUndefined();
    // This is the step where she decides to hand something over, so this is
    // where the promise belongs.
    expect(content.security?.message).toContain('en tu teléfono');
  });

  it('generating: the verification is the screen, and there is nothing to press', () => {
    const content = buildProofScreenContent({ ...base, phase: 'generating', now: 12_400, startedAt: 1_000 });
    expect(content.archetype).toBe('verifying');
    expect(content.title).toBe('verifying-title');
    expect(content.wait?.elapsedValue).toBe('11 s');
    // A disabled button saying "trabajando…" only repeated the ring.
    expect(content.ctaLabel).toBeUndefined();
    expect(content.synthetic).toBe(false);
  });

  it('generating past the measured run: the headline stops narrating the work', () => {
    const content = buildProofScreenContent({ ...base, phase: 'generating', now: 40_000, startedAt: 0 });
    expect(content.wait?.overtime).toBe(true);
    expect(content.title).toBe('Estamos terminando');
    expect(content.lede).toContain('No necesitas hacer nada');
  });

  it('ready: the confirm archetype, dramatically unlike the one before it', () => {
    const content = buildProofScreenContent({ ...base, phase: 'ready', now: 0, value: true });
    expect(content.archetype).toBe('confirm');
    expect(content.tone).toBe('success');
    expect(content.ctaAction).toBe('continue');
    expect(content.ctaLabel).toBe('continue-label');
    expect(content.title).toBe('ready:true');
    expect(content.lede).toBe('lede:true');
    expect(content.body).toBe('body:true');
    expect(content.synthetic).toBe(true);
    // The confirm copy carries the promise itself; a notice repeating it
    // would be the fifth container this redesign exists to remove.
    expect(content.security).toBeUndefined();
  });

  it('failed: the predicate was evaluated and does not hold; offers retry', () => {
    const content = buildProofScreenContent({ ...base, phase: 'failed', now: 0 });
    expect(content.archetype).toBe('recover');
    expect(content.tone).toBe('warning');
    expect(content.ctaAction).toBe('retry');
    expect(content.ctaDisabled).toBe(false);
    expect(content.body).toBe('failed-body');
    expect(content.title.toLowerCase()).toContain('todavía no se puede');
    // The whole question this screen raises is why, so the answer is a real
    // second action rather than the same ? every other screen carries.
    expect(content.askWhy).toBe(true);
  });

  it('degraded: needs no value, offers retry, and never reads as a rejection', () => {
    const content = buildProofScreenContent({ ...base, phase: 'degraded', now: 0 });
    expect(content.archetype).toBe('recover');
    expect(content.tone).toBe('error');
    expect(content.ctaAction).toBe('retry');
    expect(content.body).toBe('degraded-body');
    expect(content.title).toBe('No pudimos terminar la revisión');
    expect(content.synthetic).toBe(true);
  });

  it('a typed degraded reason names the one thing to fix, and stays degraded', () => {
    const content = buildProofScreenContent({ ...base, phase: 'degraded', now: 0, reason: 'wallet_locked' });
    expect(content.archetype).toBe('recover');
    expect(content.title).toBe('Cartera bloqueada');
    expect(content.ctaLabel).toBe('Reintentar');
  });

  it('throws if ready is reached without a settled value', () => {
    expect(() => buildProofScreenContent({ ...base, phase: 'ready', now: 0 })).toThrow();
  });
});
