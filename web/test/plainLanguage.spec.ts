// plainLanguage.spec.ts
// The journey is written for an entrepreneur applying for a card, not for a
// developer. Nothing she has to read first may use the vocabulary of the
// proof system; the technical claim is never deleted, only moved behind a
// disclosure that starts closed. Both halves are asserted here.

import { describe, expect, it } from 'vitest';
import type { ApiFailureReason } from '@creva-zk/api';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildCompareContent } from '../src/screens/compareContent';
import { buildOffersContent } from '../src/screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from '../src/render';
import { buildStepProgress } from '../src/domain/journeyProgress';
import { generatingBodyFor } from '../src/screens/proofProvenance';
import {
  idleProof,
  settleDegraded,
  settleFailed,
  settleReady,
  startGenerating,
  type ProofState,
} from '../src/domain/proofState';
import type { Tier } from '../src/domain/tier';

// The vocabulary of the proof system. Every one of these is legitimate — and
// belongs inside the disclosure, where a jury looks, not in the first line
// an applicant reads.
const JARGON = /\b(predicad[oa]s?|atestaci[oó]n(es)?|circuitos?|witness|disclose|testigos?|booleanos?|hash(es)?|umbral(es)?)\b/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

// Everything outside <details> — that is, everything she sees before
// choosing to see more.
function aboveTheFold(html: string): string {
  return stripTags(html.replace(/<details[\s\S]*?<\/details>/g, ' '));
}

function insideDisclosure(html: string): string {
  const blocks = [...html.matchAll(/<details[\s\S]*?<\/details>/g)].map((m) => m[0]);
  return stripTags(blocks.join(' '));
}

const IDENTITY_STATES: Array<ProofState<boolean>> = [
  idleProof<boolean>(),
  startGenerating<boolean>(0),
  settleFailed<boolean>(),
  settleReady(true),
  settleDegraded<boolean>('call_failed'),
];

const BACKING_STATES: Array<ProofState<Tier>> = [
  idleProof<Tier>(),
  startGenerating<Tier>(0),
  settleFailed<Tier>(),
  settleReady<Tier>('silver'),
  settleDegraded<Tier>('call_failed'),
];

function everyScreen(): Array<readonly [string, string]> {
  const screens: Array<readonly [string, string]> = [];
  IDENTITY_STATES.forEach((state, i) => {
    screens.push([`identity/${i}`, renderProofScreen(buildIdentityContent(state, 10_000), buildStepProgress(1, 4, 'x'))]);
  });
  BACKING_STATES.forEach((state, i) => {
    screens.push([`backing/${i}`, renderProofScreen(buildBackingContent(state, 10_000), buildStepProgress(2, 4, 'x'))]);
  });
  screens.push(['compare', renderCompareScreen(buildCompareContent(), buildStepProgress(3, 4, 'x'))]);
  screens.push(['offers', renderOffersScreen(buildOffersContent('silver'), buildStepProgress(4, 4, 'x'))]);
  return screens;
}

describe('plain language above the fold', () => {
  it.each(everyScreen())('%s uses no proof-system vocabulary before the disclosure', (label, html) => {
    const match = aboveTheFold(html).match(JARGON);
    expect(match, `${label} says "${match?.[0]}" where she has to read it`).toBeNull();
  });

  it.each(everyScreen())('%s never names a step after the mechanism behind it', (_label, html) => {
    // "Paso 1 de 4 — IDENTIDAD" told her which subsystem was running. The
    // step label now names what the step is about.
    expect(aboveTheFold(html)).not.toMatch(/\bpaso \d de \d\s*[—-]\s*(identidad|respaldo|comparaci[oó]n|ofertas)\b/i);
  });
});

describe('the technical claim is moved, never deleted', () => {
  it.each(everyScreen())('%s carries a disclosure that starts closed', (_label, html) => {
    expect(html).toMatch(/<details class="tech">/);
    // No `open` attribute: the first read has to work without it.
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('Ver el detalle técnico');
  });

  it('keeps the exact predicate claim on the identity screen', () => {
    const html = renderProofScreen(buildIdentityContent(idleProof<boolean>(), 0), buildStepProgress(1, 4, 'x'));
    const detail = insideDisclosure(html);
    expect(detail).toMatch(/atestaci[oó]n/i);
    expect(detail).toMatch(/predicado/i);
    expect(detail).toMatch(/conocimiento cero/i);
  });

  it('keeps the exact disclosure claim on the backing screen', () => {
    const html = renderProofScreen(buildBackingContent(idleProof<Tier>(), 0), buildStepProgress(2, 4, 'x'));
    const detail = insideDisclosure(html);
    expect(detail).toMatch(/circuito/i);
    expect(detail).toMatch(/testigo privado/i);
    expect(detail).toMatch(/nunca el monto del colateral/i);
  });
});

describe('buttons say what happens next', () => {
  it('never reuses one label for every step', () => {
    const labels = [
      buildIdentityContent(idleProof<boolean>(), 0).ctaLabel,
      buildIdentityContent(settleReady(true), 0).ctaLabel,
      buildBackingContent(settleReady<Tier>('silver'), 0).ctaLabel,
      buildCompareContent().ctaLabel,
      buildOffersContent('silver').ctaLabel,
    ];
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain('Continuar');
  });

  it('the identity button opens the application and the next one names the tier question', () => {
    expect(buildIdentityContent(idleProof<boolean>(), 0).ctaLabel).toBe('Solicita la tarjeta');
    expect(buildIdentityContent(settleReady(true), 0).ctaLabel).toBe('Ver a qué califico');
  });

  it('failed and degraded stay different screens with different words', () => {
    const failed = buildIdentityContent(settleFailed<boolean>(), 0);
    const degraded = buildIdentityContent(settleDegraded<boolean>('call_failed'), 0);

    expect(failed.statusHeading).not.toBe(degraded.statusHeading);
    expect(failed.statusBody).not.toBe(degraded.statusBody);
    expect(failed.ctaLabel).not.toBe(degraded.ctaLabel);

    // Degraded says nobody could check, and offers only a retry.
    expect(degraded.statusBody.toLowerCase()).toContain('nadie pudo');
    expect(degraded.ctaLabel).toBe('Reintentar');
    expect(degraded.ctaAction).toBe('retry');
    expect(failed.ctaAction).toBe('retry');
  });
});

describe('the wait is staged, not spun', () => {
  it('puts the whole sequence and the standing promise on the identity screen', () => {
    const content = buildIdentityContent(startGenerating<boolean>(0), 6_000);
    const html = renderProofScreen(content, buildStepProgress(1, 4, 'x'));

    expect(content.wait?.stages.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('data-role="wait"');
    expect(html).toContain('Todo esto pasa en tu teléfono');
    expect(html).toMatch(/data-status="active"/);
    // Every stage is on screen from the start — the sequence is the screen.
    expect([...html.matchAll(/data-stage-index="/g)]).toHaveLength(content.wait!.stages.length);
  });

  it('says on both screens that the work is happening on her own device', () => {
    for (const build of [
      () => buildIdentityContent(startGenerating<boolean>(0), 3_000),
      () => buildBackingContent(startGenerating<Tier>(0), 3_000),
    ]) {
      const content = build();
      expect(content.wait?.stages[0]?.label.toLowerCase()).toContain('en tu teléfono');
      expect(content.wait?.stages[0]?.detail.toLowerCase()).toContain('dispositivo');
    }
  });

  it('shows no wait region on any settled screen', () => {
    expect(buildIdentityContent(settleReady(true), 0).wait).toBeUndefined();
    expect(buildIdentityContent(settleFailed<boolean>(), 0).wait).toBeUndefined();
    expect(buildIdentityContent(idleProof<boolean>(), 0).wait).toBeUndefined();
  });
});

describe('the split screen reads with every label hidden', () => {
  it('carries icon, direction and outcome without a single word', () => {
    const content = buildCompareContent();
    const html = renderCompareScreen(content, buildStepProgress(3, 4, 'x'));

    // Strip every text node, keeping only the tags: what survives is what a
    // reader who cannot read the labels still sees.
    const structure = html.replace(/>[^<]*</g, '><');

    // One arrow per row on the left, a strike on every row on the right, and
    // exactly one chip standing in for everything that crossed.
    expect([...structure.matchAll(/compare-arrow/g)]).toHaveLength(content.items.length);
    expect([...structure.matchAll(/compare-item--crossed/g)]).toHaveLength(content.items.length);
    expect([...structure.matchAll(/compare-outcome-chip/g)]).toHaveLength(1);
    // The two halves are told apart by their own class, not by their titles.
    expect(structure).toContain('compare-col--exposed');
    expect(structure).toContain('compare-col--sealed');
  });
});

// The four reasons the browser-direct path can tell apart before a proof is
// even attempted. They are still degraded screens, and they still have to be
// readable by someone who has never heard of a proof system.
const LACE_REASONS: readonly ApiFailureReason[] = [
  'wallet_absent',
  'wallet_locked',
  'wallet_wrong_network',
  'proof_server_unreachable',
];

describe('the typed degraded reasons stay plain, and stay degraded', () => {
  it.each(LACE_REASONS)('%s renders with no proof-system vocabulary', (reason) => {
    for (const html of [
      renderProofScreen(buildIdentityContent(settleDegraded<boolean>(reason), 0), buildStepProgress(1, 4, 'x')),
      renderProofScreen(buildBackingContent(settleDegraded<Tier>(reason), 0), buildStepProgress(2, 4, 'x')),
    ]) {
      const match = aboveTheFold(html).match(JARGON);
      expect(match, `${reason} says "${match?.[0]}" where she has to read it`).toBeNull();
    }
  });

  it.each(LACE_REASONS)('%s says nobody could check, and offers only a retry', (reason) => {
    const content = buildBackingContent(settleDegraded<Tier>(reason), 0);
    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
    expect(content.ctaLabel).toBe('Reintentar');
    // Never the failed screen's words: nothing was evaluated.
    expect(content.statusHeading).not.toBe(buildBackingContent(settleFailed<Tier>(), 0).statusHeading);
    expect(content.statusBody.toLowerCase()).toMatch(/nadie pudo (comprobar|revisar)/);
  });
});

describe('where the proof runs is said plainly, on every source', () => {
  it.each(['stub', 'real', 'bridge', 'lace'] as const)('%s uses no jargon', (source) => {
    const match = generatingBodyFor(source).match(JARGON);
    expect(match, `the ${source} provenance says "${match?.[0]}"`).toBeNull();
  });
});

describe('the milestone lands on the tier, not on the proof', () => {
  it('celebrates knowing what she qualifies for, once, on the result screen', () => {
    const html = renderOffersScreen(buildOffersContent('silver'), buildStepProgress(4, 4, 'x'));
    expect(html).toContain('tier-reveal');
    expect(html).toContain(buildOffersContent('silver').milestone);
    // Exactly one reveal — a celebration on every screen is not a milestone.
    expect([...html.matchAll(/tier-reveal/g)]).toHaveLength(1);
  });

  it('never celebrates a proof completing on the way there', () => {
    for (const html of [
      renderProofScreen(buildIdentityContent(settleReady(true), 0), buildStepProgress(1, 4, 'x')),
      renderProofScreen(buildBackingContent(settleReady<Tier>('silver'), 0), buildStepProgress(2, 4, 'x')),
      renderCompareScreen(buildCompareContent(), buildStepProgress(3, 4, 'x')),
    ]) {
      expect(html).not.toContain('tier-reveal');
      expect(html).not.toContain('tier-milestone');
    }
  });
});

describe('the progress block says what is done and what is left', () => {
  it.each(everyScreen())('%s carries both halves of the tally', (_label, html) => {
    expect(html).toContain('progress-tally');
    expect(html).toMatch(/te falta(n)? \d/);
  });
});
