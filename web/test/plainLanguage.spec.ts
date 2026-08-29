// plainLanguage.spec.ts
// The journey is written for an entrepreneur applying for a card, not for a
// developer. No screen may use the vocabulary of the proof system anywhere —
// there is no disclosure to hide it in any more. The explanation lives in
// the help centre, and every screen carries a ? that reaches it.

import { describe, expect, it } from 'vitest';
import type { ApiFailureReason } from '@creva-zk/api';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildCompareContent } from '../src/screens/compareContent';
import { buildOffersContent } from '../src/screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from '../src/render';
import { buildStepProgress } from '../src/domain/journeyProgress';
import { verifyingLedeFor } from '../src/screens/proofProvenance';
import {
  idleProof,
  settleDegraded,
  settleFailed,
  settleReady,
  startGenerating,
  type ProofState,
} from '../src/domain/proofState';
import type { Tier } from '../src/domain/tier';
import { CELEBRATION_MS, MEASURED_PROOF_MS } from '../src/domain/waitStages';

// The vocabulary of the proof system. Every one of these is legitimate, and
// none of it belongs on a screen she has to get through: expanding a word
// mid-task still asks her to learn it to finish. It lives in help content.
const JARGON = /\b(predicad[oa]s?|atestaci[oó]n(es)?|circuitos?|witness|disclose|testigos?|booleanos?|hash(es)?|umbral(es)?)\b/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

// The whole screen now: with the disclosure gone there is no "further in"
// left for a technical word to hide in.
function aboveTheFold(html: string): string {
  return stripTags(html);
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
  it.each(everyScreen())('%s uses no proof-system vocabulary anywhere on it', (label, html) => {
    const match = aboveTheFold(html).match(JARGON);
    expect(match, `${label} says "${match?.[0]}" where she has to read it`).toBeNull();
  });

  it.each(everyScreen())('%s never names a step after the mechanism behind it', (_label, html) => {
    // "Paso 1 de 4 — IDENTIDAD" told her which subsystem was running. The
    // step label now names what the step is about.
    expect(aboveTheFold(html)).not.toMatch(/\bpaso \d de \d\s*[—-]\s*(identidad|respaldo|comparaci[oó]n|ofertas)\b/i);
  });
});

describe('the explanation left the flow, and is one tap away', () => {
  it.each(everyScreen())('%s carries no disclosure to expand mid-task', (_label, html) => {
    expect(html).not.toContain('<details');
    expect(html).not.toContain('Ver el detalle técnico');
  });

  it.each(everyScreen())('%s carries a ? that reaches the help centre', (_label, html) => {
    expect(html).toContain('data-role="help-link"');
    expect(html, 'no help href on the screen').toMatch(/href="#\/ayuda\/[^"]+\/[^"]+"/);
    // The ? is a 44px icon in the navigation strip now rather than a
    // full-width card, but it still carries its label as real text: that is
    // the control's accessible name, not just a tooltip.
    expect(html).toContain('>Ayuda<');
  });

  it.each(everyScreen())('%s carries exactly one ?, not a card and a link', (_label, html) => {
    expect([...html.matchAll(/data-role="help-link"/g)]).toHaveLength(1);
  });

  it('asks the failure states the question they actually raise', () => {
    for (const content of [
      buildIdentityContent(settleFailed<boolean>(), 0),
      buildIdentityContent(settleDegraded<boolean>('call_failed'), 0),
    ]) {
      expect(content.askWhy).toBe(true);
      const html = renderProofScreen(content, buildStepProgress(1, 4, 'x'));
      expect(html).toContain('data-role="help-why"');
      expect(html).toContain('¿Por qué ocurrió?');
    }

    // And nowhere else: it is a second action, not a decoration.
    for (const content of [
      buildIdentityContent(idleProof<boolean>(), 0),
      buildIdentityContent(settleReady(true), 0),
    ]) {
      expect(content.askWhy).toBe(false);
      expect(renderProofScreen(content, buildStepProgress(1, 4, 'x'))).not.toContain('data-role="help-why"');
    }
  });

  it('points every screen at an article that answers that screen', () => {
    expect(buildIdentityContent(idleProof<boolean>(), 0).help).toBe('privacidad/que-ve-creva');
    expect(buildBackingContent(idleProof<Tier>(), 0).help).toBe('privacidad/sin-ver-mi-saldo');
    expect(buildCompareContent().help).toBe('privacidad/donde-quedan-mis-datos');
    expect(buildOffersContent('silver').help).toBe('resultado/que-es-un-nivel');
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

    expect(failed.title).not.toBe(degraded.title);
    expect(failed.body).not.toBe(degraded.body);
    expect(failed.ctaLabel).not.toBe(degraded.ctaLabel);

    // Degraded says nobody could check, and offers only a retry.
    expect(degraded.body?.toLowerCase()).toContain('nadie pudo');
    expect(degraded.ctaLabel).toBe('Reintentar');
    expect(degraded.ctaAction).toBe('retry');
    expect(failed.ctaAction).toBe('retry');
  });
});

describe('the wait is staged, not spun', () => {
  it('shows the one step happening now, and the standing promise, on the identity screen', () => {
    const content = buildIdentityContent(startGenerating<boolean>(0), 6_000);
    const html = renderProofScreen(content, buildStepProgress(1, 4, 'x'));

    expect(content.wait?.totalStages).toBeGreaterThanOrEqual(4);
    expect(html).toContain('data-role="wait"');
    // The promise is a line under the work now, not a card above it — and it
    // is short, with the rest of it a tap away.
    expect(html).toContain('Todo ocurre en tu teléfono');
    expect(html).toContain('Más información');
    expect(html.match(/Todo ocurre en tu teléfono[^<]*/)![0].length).toBeLessThan(90);
    expect(html).toMatch(/data-status="active"/);
    // Exactly one step on screen: a list of four read as a to-do list.
    expect([...html.matchAll(/data-stage-index="/g)]).toHaveLength(1);
    expect(html).toContain(content.wait!.current.label);
    // The ring and the seconds carry the sense of progress the list used to.
    expect(html).toContain('data-role="wait-ring-fill"');
    expect(html).toContain(content.wait!.elapsedValue);
  });

  it('keeps the real stages long enough that a held check never eats the next one', () => {
    for (const build of [
      (ms: number) => buildIdentityContent(startGenerating<boolean>(0), ms),
      (ms: number) => buildBackingContent(startGenerating<Tier>(0), ms),
    ]) {
      // Walk the run and collect the moment each stage first appears.
      const firstSeen = new Map<number, number>();
      for (let elapsed = 0; elapsed <= MEASURED_PROOF_MS; elapsed += 100) {
        const wait = build(elapsed).wait!;
        if (!firstSeen.has(wait.activeIndex)) firstSeen.set(wait.activeIndex, elapsed);
      }
      const starts = [...firstSeen.entries()].sort((a, b) => a[0] - b[0]).map(([, ms]) => ms);
      for (let i = 1; i < starts.length; i += 1) {
        expect(starts[i]! - starts[i - 1]!, 'a stage shorter than the held beat').toBeGreaterThan(
          CELEBRATION_MS,
        );
      }
    }
  });

  it('shows only one step at a time, all the way through both waits', () => {
    for (const build of [
      (ms: number) => buildIdentityContent(startGenerating<boolean>(0), ms),
      (ms: number) => buildBackingContent(startGenerating<Tier>(0), ms),
    ]) {
      for (let elapsed = 0; elapsed <= MEASURED_PROOF_MS + 10_000; elapsed += 200) {
        const html = renderProofScreen(build(elapsed), buildStepProgress(1, 4, 'x'));
        expect([...html.matchAll(/data-stage-index="/g)], `two steps at ${elapsed}ms`).toHaveLength(1);
        // The ring and the seconds are always there to carry the progress.
        expect(html).toContain('data-role="wait-ring-fill"');
        expect(html).toMatch(/>\d+ s</);
      }
    }
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

// The five reasons the browser-direct path can tell apart before a proof is
// even attempted. They are still degraded screens, and they still have to be
// readable by someone who has never heard of a proof system.
const LACE_REASONS: readonly ApiFailureReason[] = [
  'wallet_absent',
  'wallet_locked',
  'wallet_wrong_network',
  'proof_server_unreachable',
  'contract_not_found',
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
    expect(content.title).not.toBe(buildBackingContent(settleFailed<Tier>(), 0).title);
    expect(content.body?.toLowerCase()).toMatch(/nadie pudo (comprobar|revisar)/);
  });
});

describe('where the proof runs is said plainly, on every source', () => {
  it.each(['stub', 'real', 'bridge', 'lace'] as const)('%s uses no jargon', (source) => {
    const match = verifyingLedeFor(source).match(JARGON);
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

// Criterion 3 of the redesign: one compact progress treatment, and the same
// fact is never stated twice. The flow used to print "Paso 1 de 4 · Quién
// eres" above "Son 4 pasos · te faltan 4" on every screen.
describe('progress is said once, and only once', () => {
  it.each(everyScreen())('%s carries one step indicator and no second tally', (_label, html) => {
    expect([...html.matchAll(/class="stepper"/g)]).toHaveLength(1);
    expect(html).toMatch(/class="stepper-count">\d de \d</);
    expect(html).not.toMatch(/te falta(n)? \d/);
    expect(html).not.toMatch(/\d listos?/);
  });
});

// Criterion 1 and 14: the screen has one focal point, not a stack of
// bordered surfaces each holding one sentence.
describe('a screen is not a stack of cards', () => {
  it.each(everyScreen())('%s puts its state in the headline, not in a status card', (_label, html) => {
    expect(html).not.toContain('status-panel');
    expect(html).toContain('data-role="screen-title"');
  });

  it.each(everyScreen())('%s renders nothing the state does not need', (_label, html) => {
    // The three the old flow rendered on every screen regardless of state.
    expect(html).not.toContain('Trabajando en tu teléfono');
    expect(html).not.toContain('Preguntas sobre esta pantalla');
    expect(html).not.toContain('class="status"');
  });
});
