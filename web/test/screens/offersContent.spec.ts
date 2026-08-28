// offersContent.spec.ts
// Unit test for src/screens/offersContent.ts: the tier is shown, and the
// no-catalogue disclaimer never claims a rate or lender.

import { describe, expect, it } from 'vitest';
import { buildOffersContent } from '../../src/screens/offersContent';

describe('buildOffersContent', () => {
  it('shows the human label for the proven tier, in Spanish', () => {
    expect(buildOffersContent('gold').tierLabel).toBe('Oro');
  });

  it('states plainly that no catalogue is connected', () => {
    const { disclaimer } = buildOffersContent('silver');
    expect(disclaimer.toLowerCase()).toContain('catálogo de crédito');
    expect(disclaimer.toLowerCase()).not.toMatch(/\d+%|\bapr\b/);
  });
});
