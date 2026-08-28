// compareContent.spec.ts
// Unit test for the before/after split content in
// src/screens/compareContent.ts: the same three items appear on both sides,
// with exactly one outcome chip standing in for the counterparty on the
// right — the asymmetry a text-hidden reader has to pick up on.

import { describe, expect, it } from 'vitest';
import { buildCompareContent } from '../../src/screens/compareContent';

describe('buildCompareContent', () => {
  it('shows exactly three shared items — document, selfie, balance', () => {
    const content = buildCompareContent();
    expect(content.items).toHaveLength(3);
  });

  it('carries exactly one outcome chip, distinct from the three items', () => {
    const content = buildCompareContent();
    expect(content.outcomeChip.icon).toBeTruthy();
    expect(content.outcomeChip.label).toBeTruthy();
    const itemIcons = new Set(content.items.map((item) => item.icon));
    expect(itemIcons.has(content.outcomeChip.icon)).toBe(false);
  });

  it('names a counterparty distinct from the three items and the chip', () => {
    const content = buildCompareContent();
    const itemIcons = new Set(content.items.map((item) => item.icon));
    expect(itemIcons.has(content.counterpartyIcon)).toBe(false);
    expect(content.counterpartyIcon).not.toBe(content.outcomeChip.icon);
  });
});
