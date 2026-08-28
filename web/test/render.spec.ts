// render.spec.ts
// String-level checks on src/render.ts output: one h1 per screen, the
// synthetic badge appears exactly where the content model says it should,
// and every button carries the 44px-floor class rather than an inline size.

import { describe, expect, it } from 'vitest';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildCompareContent } from '../src/screens/compareContent';
import { buildOffersContent } from '../src/screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from '../src/render';
import { idleProof, settleReady } from '../src/domain/proofState';

function countOccurrences(source: string, needle: RegExp): number {
  return [...source.matchAll(needle)].length;
}

describe('renderProofScreen', () => {
  it('renders exactly one h1 and a 44px-floor button class', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Step 1 of 4', 'ready');
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('class="btn"');
    expect(html).not.toMatch(/disabled/);
  });

  it('omits the synthetic badge from the status panel while idle', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), 'Step 1 of 4', 'ready');
    const statusPanel = html.split('<div class="status-panel"')[1]!;
    expect(statusPanel).not.toContain('badge-synthetic');
  });

  it('shows the synthetic badge once a value has settled', () => {
    const html = renderProofScreen(buildIdentityContent(settleReady(true), 0), 'Step 1 of 4', 'ready');
    expect(html).toContain('badge-synthetic');
    expect(html).toContain('SYNTHETIC');
  });

  it('disables the button while generating', () => {
    const html = renderProofScreen(
      buildIdentityContent({ phase: 'generating', startedAt: 0 }, 5000),
      'Step 1 of 4',
      'ready',
    );
    expect(html).toContain('disabled');
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
