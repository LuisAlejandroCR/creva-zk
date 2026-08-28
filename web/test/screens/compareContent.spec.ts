// compareContent.spec.ts
// Unit test for the before/after split content in
// src/screens/compareContent.ts: the asymmetry between columns is the point.

import { describe, expect, it } from 'vitest';
import { buildCompareContent } from '../../src/screens/compareContent';

describe('buildCompareContent', () => {
  it('hands over far more on the left than the right', () => {
    const content = buildCompareContent();
    expect(content.leftRows.length).toBeGreaterThan(content.rightRows.length);
    expect(content.rightRows.length).toBeLessThanOrEqual(2);
  });

  it('uses a distinct icon vocabulary per column', () => {
    const content = buildCompareContent();
    const leftIcons = new Set(content.leftRows.map((row) => row.icon));
    const rightIcons = new Set(content.rightRows.map((row) => row.icon));
    for (const icon of rightIcons) expect(leftIcons.has(icon)).toBe(false);
  });
});
