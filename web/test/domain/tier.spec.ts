// tier.spec.ts
// Unit tests for the local Tier stub in src/domain/tier.ts: the type guard
// and the completeness of its label map.

import { describe, expect, it } from 'vitest';
import { isTier, TIER_LABELS, type Tier } from '../../src/domain/tier';

describe('isTier', () => {
  it('accepts every known tier', () => {
    const tiers: Tier[] = ['none', 'bronze', 'silver', 'gold'];
    for (const tier of tiers) expect(isTier(tier)).toBe(true);
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isTier('platinum')).toBe(false);
    expect(isTier(1)).toBe(false);
    expect(isTier(undefined)).toBe(false);
  });
});

describe('TIER_LABELS', () => {
  it('has a human label for every tier', () => {
    const tiers: Tier[] = ['none', 'bronze', 'silver', 'gold'];
    for (const tier of tiers) {
      expect(TIER_LABELS[tier]).toBeTruthy();
    }
  });
});
