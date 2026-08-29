// render.spec.ts
// String-level checks on src/render.ts output: one h1 per screen, one
// navigation layer, the archetype each state is rendered in, the synthetic
// badge exactly where the content model says it belongs, the CTA carrying
// Creva's real button class, and the compare screen rendering the same three
// items on both sides — crossed on the right, alongside a single outcome
// chip.
//
// The archetype assertions are the ones that keep the redesign honest: four
// states rendered in four shapes, rather than one layout with different
// words in the same cards.

import { describe, expect, it } from 'vitest';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildCompareContent } from '../src/screens/compareContent';
import { buildOffersContent } from '../src/screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from '../src/render';
import { buildStepProgress } from '../src/domain/journeyProgress';
import { idleProof, settleDegraded, settleFailed, settleReady } from '../src/domain/proofState';

function countOccurrences(source: string, needle: RegExp): number {
  return [...source.matchAll(needle)].length;
}

const step = buildStepProgress(1, 4, 'Quién eres');

describe('renderProofScreen', () => {
  it('renders exactly one h1 and Creva\'s primary button class', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), step);
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('class="btn-primary"');
    expect(html).not.toMatch(/disabled/);
  });

  it('carries one navigation layer: the brand and where she is, once each', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), step);
    expect(countOccurrences(html, /class="topbar"/g)).toBe(1);
    expect(countOccurrences(html, /class="stepper"/g)).toBe(1);
    expect(html).toContain('1 de 4');
    expect(html).toContain('aria-label="Paso 1 de 4: Quién eres"');
    // One segment per step, and exactly one of them is where she is.
    expect(countOccurrences(html, /class="stepper-seg"/g)).toBe(4);
    expect(countOccurrences(html, /data-state="current"/g)).toBe(1);
  });

  it('renders each proof state in an archetype of its own', () => {
    const archetypeOf = (html: string): string =>
      html.match(/data-archetype="([a-z]+)"/)?.[1] ?? '';

    const archetypes = [
      archetypeOf(renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), step)),
      archetypeOf(renderProofScreen(buildIdentityContent({ phase: 'generating', startedAt: 0 }, 5000), step)),
      archetypeOf(renderProofScreen(buildIdentityContent(settleReady(true), 0), step)),
      archetypeOf(renderProofScreen(buildIdentityContent(settleDegraded('call_failed'), 0), step)),
    ];

    expect(archetypes).toEqual(['intro', 'verifying', 'confirm', 'recover']);
  });

  // The semantic families are still keyed off the phase, so a future edit
  // cannot quietly detach a state from Creva's own palette.
  it.each([
    ['idle', idleProof<boolean>()],
    ['generating', { phase: 'generating' as const, startedAt: 0 }],
    ['failed', settleFailed<boolean>()],
    ['ready', settleReady(true)],
    ['degraded', settleDegraded<boolean>('call_failed')],
  ])('tags the %s screen with its phase', (phase, state) => {
    const html = renderProofScreen(buildIdentityContent(state, 5_000), step);
    expect(html).toContain(`data-phase="${phase}"`);
  });

  it('makes the verification the hero while a proof runs, and offers no button', () => {
    const html = renderProofScreen(buildIdentityContent({ phase: 'generating', startedAt: 0 }, 5000), step);
    expect(html).toContain('data-role="wait-ring"');
    // One step in its slot, never a list of four.
    expect(html).toContain('class="verify-step-slot"');
    expect([...html.matchAll(/data-stage-index="/g)]).toHaveLength(1);
    // Nothing to press: a disabled button would only repeat the ring.
    expect(html).not.toContain('data-role="cta"');
  });

  it('omits the synthetic badge before anything has settled', () => {
    for (const state of [idleProof<boolean>(), { phase: 'generating' as const, startedAt: 0 }]) {
      expect(renderProofScreen(buildIdentityContent(state, 5_000), step)).not.toContain('badge-synthetic');
    }
  });

  it('shows the synthetic badge once a value has settled', () => {
    const html = renderProofScreen(buildIdentityContent(settleReady(true), 0), step);
    expect(html).toContain('badge-synthetic');
  });

  // Criterion 6 of the redesign: only show a component where it helps that
  // particular state. The promise belongs where she hands something over.
  it('shows the security notice while her data is being handled, and not after', () => {
    const during = [idleProof<boolean>(), { phase: 'generating' as const, startedAt: 0 }];
    for (const state of during) {
      expect(renderProofScreen(buildIdentityContent(state, 5_000), step)).toContain('security-notice');
    }
    for (const state of [settleReady(true), settleFailed<boolean>()]) {
      expect(renderProofScreen(buildIdentityContent(state, 0), step)).not.toContain('security-notice');
    }
  });
});

describe('renderCompareScreen', () => {
  it('renders exactly one h1', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, buildStepProgress(3, 4, 'x'));
    expect(countOccurrences(html, /<h1/g)).toBe(1);
  });

  it('renders the same three items on both sides', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, buildStepProgress(3, 4, 'x'));
    for (const item of content.items) {
      expect(countOccurrences(html, new RegExp(item.icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toBe(2);
    }
  });

  it('crosses out every item on the right, and none on the left', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, buildStepProgress(3, 4, 'x'));
    const leftHalf = html.split('compare-col--sealed')[0]!;
    const rightHalf = html.split('compare-col--sealed')[1]!;
    expect(countOccurrences(leftHalf, /compare-item--crossed/g)).toBe(0);
    expect(countOccurrences(rightHalf, /compare-item--crossed/g)).toBe(content.items.length);
  });

  it('carries an arrow per left row and exactly one outcome chip', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, buildStepProgress(3, 4, 'x'));
    expect(countOccurrences(html, /compare-arrow/g)).toBe(content.items.length);
    expect(countOccurrences(html, /compare-outcome-chip/g)).toBe(1);
    expect(html).toContain(content.counterpartyIcon);
  });
});

describe('renderOffersScreen', () => {
  it('renders exactly one h1 and labels the tier synthetic, in Spanish', () => {
    const html = renderOffersScreen(buildOffersContent('bronze'), buildStepProgress(4, 4, 'x'));
    expect(countOccurrences(html, /<h1/g)).toBe(1);
    expect(html).toContain('Bronce');
    expect(html).toContain('badge-synthetic');
    expect(html.toLowerCase()).toContain('catálogo de crédito');
  });

  it('lands on its own archetype, so the result never reads as one more step', () => {
    const html = renderOffersScreen(buildOffersContent('gold'), buildStepProgress(4, 4, 'x'));
    expect(html).toContain('data-archetype="celebrate"');
  });
});
