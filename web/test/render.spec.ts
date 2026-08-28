// render.spec.ts
// String-level checks on src/render.ts output: one h1 per screen, the
// synthetic badge appears exactly where the content model says it should,
// the CTA carries Creva's real button class, each proof phase carries the
// Creva semantic data-phase attribute its CSS keys off of, and the compare
// screen renders the same three items on both sides — crossed on the right,
// alongside a single outcome chip.

import { describe, expect, it } from 'vitest';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildCompareContent } from '../src/screens/compareContent';
import { buildOffersContent } from '../src/screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from '../src/render';
import { idleProof, settleDegraded, settleFailed, settleReady } from '../src/domain/proofState';

function countOccurrences(source: string, needle: RegExp): number {
  return [...source.matchAll(needle)].length;
}

describe('renderProofScreen', () => {
  it('renders exactly one h1 and Creva\'s primary button class', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Paso 1 de 4', 'ready');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('class="btn-primary"');
    expect(html).not.toMatch(/disabled/);
  });

  it('tags the idle status panel with the idle phase, not a semantic one', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Paso 1 de 4', 'ready');
    expect(html).toContain('data-phase="idle"');
  });

  it('tags the generating panel so it picks up --cr-warning-*', () => {
    const html = renderProofScreen(
      buildIdentityContent({ phase: 'generating', startedAt: 0 }, 5000),
      'Paso 1 de 4',
      'ready',
    );
    expect(html).toContain('data-phase="generating"');
    expect(html).toContain('disabled');
  });

  it('tags the failed panel so it picks up --cr-danger-*', () => {
    const html = renderProofScreen(buildIdentityContent(settleFailed<boolean>(), 0), 'Paso 1 de 4', 'failed');
    expect(html).toContain('data-phase="failed"');
  });

  it('tags the ready panel so it picks up --cr-success-*', () => {
    const html = renderProofScreen(buildIdentityContent(settleReady(true), 0), 'Paso 1 de 4', 'ready');
    expect(html).toContain('data-phase="ready"');
  });

  it('tags the degraded panel so it picks up --cr-info-*', () => {
    const html = renderProofScreen(buildIdentityContent(settleDegraded(true), 0), 'Paso 1 de 4', 'degraded');
    expect(html).toContain('data-phase="degraded"');
  });

  it('omits the synthetic badge from the status panel while idle', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Paso 1 de 4', 'ready');
    const statusPanel = html.split('<div class="status-panel"')[1]!;
    expect(statusPanel).not.toContain('badge-synthetic');
  });

  it('shows the synthetic badge once a value has settled', () => {
    const html = renderProofScreen(buildIdentityContent(settleReady(true), 0), 'Paso 1 de 4', 'ready');
    expect(html).toContain('badge-synthetic');
  });
});

describe('renderCompareScreen', () => {
  it('renders exactly one h1', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, 'Paso 3 de 4');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
  });

  it('renders the same three items on both sides', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, 'Paso 3 de 4');
    for (const item of content.items) {
      expect(countOccurrences(html, new RegExp(item.icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toBe(2);
    }
  });

  it('crosses out every item on the right, and none on the left', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, 'Paso 3 de 4');
    const leftHalf = html.split('compare-col--sealed')[0]!;
    const rightHalf = html.split('compare-col--sealed')[1]!;
    expect(countOccurrences(leftHalf, /compare-item--crossed/g)).toBe(0);
    expect(countOccurrences(rightHalf, /compare-item--crossed/g)).toBe(content.items.length);
  });

  it('carries an arrow per left row and exactly one outcome chip', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, 'Paso 3 de 4');
    expect(countOccurrences(html, /compare-arrow/g)).toBe(content.items.length);
    expect(countOccurrences(html, /compare-outcome-chip/g)).toBe(1);
    expect(html).toContain(content.counterpartyIcon);
  });
});

describe('renderOffersScreen', () => {
  it('renders exactly one h1 and labels the tier synthetic, in Spanish', () => {
    const html = renderOffersScreen(buildOffersContent('bronze'), 'Paso 4 de 4');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('Bronce');
    expect(html).toContain('badge-synthetic');
    expect(html.toLowerCase()).toContain('catálogo de crédito');
  });
});
