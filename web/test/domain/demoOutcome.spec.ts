// demoOutcome.spec.ts
// Unit tests for the synthetic scenario-to-outcome mapping in
// src/domain/demoOutcome.ts — the only source of proof results in this app.

import { describe, expect, it } from 'vitest';
import { backingOutcomeFor, identityOutcomeFor } from '../../src/domain/demoOutcome';

describe('identityOutcomeFor', () => {
  it('is verified when ready', () => {
    expect(identityOutcomeFor('ready')).toBe(true);
  });

  it('is not verified when failed', () => {
    expect(identityOutcomeFor('failed')).toBe(false);
  });

  it('is verified when degraded (fallback path still holds)', () => {
    expect(identityOutcomeFor('degraded')).toBe(true);
  });
});

describe('backingOutcomeFor', () => {
  it('yields a real tier when ready', () => {
    expect(backingOutcomeFor('ready')).not.toBe('none');
  });

  it('yields no tier when failed', () => {
    expect(backingOutcomeFor('failed')).toBe('none');
  });

  it('yields a real tier when degraded (fallback path still holds)', () => {
    expect(backingOutcomeFor('degraded')).not.toBe('none');
  });
});
