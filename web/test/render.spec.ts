// render.spec.ts
// String-level checks on src/render.ts output: one h1 per screen, the
// synthetic badge appears exactly where the content model says it should,
// the CTA carries Creva's real button class, and each proof phase carries
// the Creva semantic data-phase attribute its CSS keys off of.

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
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Step 1 of 4', 'ready');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('class="btn-primary"');
    expect(html).not.toMatch(/disabled/);
  });

  it('tags the idle status panel with the idle phase, not a semantic one', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Step 1 of 4', 'ready');
    expect(html).toContain('data-phase="idle"');
  });

  it('tags the generating panel so it picks up --cr-warning-*', () => {
    const html = renderProofScreen(
      buildIdentityContent({ phase: 'generating', startedAt: 0 }, 5000),
      'Step 1 of 4',
      'ready',
    );
    expect(html).toContain('data-phase="generating"');
    expect(html).toContain('disabled');
  });

  it('tags the failed panel so it picks up --cr-danger-*', () => {
    const html = renderProofScreen(buildIdentityContent(settleFailed<boolean>(), 0), 'Step 1 of 4', 'failed');
    expect(html).toContain('data-phase="failed"');
  });

  it('tags the ready panel so it picks up --cr-success-*', () => {
    const html = renderProofScreen(buildIdentityContent(settleReady(true), 0), 'Step 1 of 4', 'ready');
    expect(html).toContain('data-phase="ready"');
  });

  it('tags the degraded panel so it picks up --cr-info-*', () => {
    const html = renderProofScreen(buildIdentityContent(settleDegraded(true), 0), 'Step 1 of 4', 'degraded');
    expect(html).toContain('data-phase="degraded"');
  });

  it('omits the synthetic badge from the status panel while idle', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Step 1 of 4', 'ready');
    const statusPanel = html.split('<div class="status-panel"')[1]!;
    expect(statusPanel).not.toContain('badge-synthetic');
  });

  it('shows the synthetic badge once a value has settled', () => {
    const html = renderProofScreen(buildIdentityContent(settleReady(true), 0), 'Step 1 of 4', 'ready');
    expect(html).toContain('badge-synthetic');
  });
});

describe('renderCompareScreen', () => {
  it('renders exactly one h1 and more left rows than right rows', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, 'Step 3 of 4');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(countOccurrences(html, /compare-col--exposed[\s\S]*?<\/ul>/g)).toBe(1);
    const leftListItems = countOccurrences(html.split('compare-col--sealed')[0]!, /<li>/g);
    expect(leftListItems).toBe(content.leftRows.length);
  });
});

describe('renderOffersScreen', () => {
  it('renders exactly one h1 and labels the tier synthetic', () => {
    const html = renderOffersScreen(buildOffersContent('bronze'), 'Step 4 of 4');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('Bronze');
    expect(html).toContain('badge-synthetic');
    expect(html.toLowerCase()).toContain('no lending catalogue');
  });
});
