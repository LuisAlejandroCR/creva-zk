// i18n.spec.ts
// The interface is Spanish-only, decided: Creva ships for Mexican
// entrepreneurs. This renders every screen, in every reachable phase, and
// fails if a stray English word from a prior draft ever leaks back in.

import { describe, expect, it } from 'vitest';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildCompareContent } from '../src/screens/compareContent';
import { buildOffersContent } from '../src/screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from '../src/render';
import { buildStepProgress } from '../src/domain/journeyProgress';
import { HELP_CATEGORIES, everyHelpArticle } from '../src/help/helpContent';
import { renderHelpArticle, renderHelpCategory, renderHelpIndex } from '../src/help/helpRender';
import {
  idleProof,
  settleDegraded,
  settleFailed,
  settleReady,
  startGenerating,
  type ProofState,
} from '../src/domain/proofState';
import { generatingBodyFor } from '../src/screens/proofProvenance';
import type { PortSource } from '../src/proofPort';
import type { ApiFailureReason } from '@creva-zk/api';
import type { Tier } from '../src/domain/tier';

// English words that would only appear here if a screen were left
// untranslated or a new one shipped without translation. Not an exhaustive
// dictionary — just the vocabulary this app's own copy would use in English.
// "selfie" is excluded: it's an accepted loanword in Mexican fintech Spanish
// (RAE-listed), not an English leak.
const ENGLISH_TELLS =
  /\b(the|and|your|proof|card|tier|start|continue|retry|ready|failed|degraded|step|offers|identity|backing|synthetic|generating|verified|verification|balance|bank|document|outcome)\b/i;

// class="…", data-role="…" etc. carry English identifiers by design (CSS
// hooks, not copy) — strip every tag so only visible text is scanned. <code>
// spans go the same way: inside the technical disclosure they name real
// artefacts (the identity-check and backing-tier circuits), and an artefact's
// name is not a translation the interface gets to make.
function visibleText(html: string): string {
  return html.replace(/<code>[\s\S]*?<\/code>/g, ' ').replace(/<[^>]*>/g, ' ');
}

function assertSpanishOnly(html: string, label: string): void {
  const match = visibleText(html).match(ENGLISH_TELLS);
  expect(match, `${label} contains an English word: ${match?.[0]}`).toBeNull();
}

describe('interface language: Spanish only, never mixed', () => {
  const identityStates: Array<ProofState<boolean>> = [
    idleProof<boolean>(),
    startGenerating<boolean>(0),
    settleFailed<boolean>(),
    settleReady(true),
    settleDegraded<boolean>('call_failed'),
  ];

  it.each(identityStates.map((state, i) => [i, state] as const))('identity screen, state %i', (_i, state) => {
    const html = renderProofScreen(buildIdentityContent(state, 10_000), buildStepProgress(1, 4, 'x'));
    assertSpanishOnly(html, 'identity screen');
  });

  const backingStates: Array<ProofState<Tier>> = [
    idleProof<Tier>(),
    startGenerating<Tier>(0),
    settleFailed<Tier>(),
    settleReady<Tier>('silver'),
    settleDegraded<Tier>('call_failed'),
  ];

  it.each(backingStates.map((state, i) => [i, state] as const))('backing screen, state %i', (_i, state) => {
    const html = renderProofScreen(buildBackingContent(state, 10_000), buildStepProgress(2, 4, 'x'));
    assertSpanishOnly(html, 'backing screen');
  });

  it('compare screen', () => {
    const html = renderCompareScreen(buildCompareContent(), buildStepProgress(3, 4, 'x'));
    assertSpanishOnly(html, 'compare screen');
  });

  it('offers screen', () => {
    const html = renderOffersScreen(buildOffersContent('gold'), buildStepProgress(4, 4, 'x'));
    assertSpanishOnly(html, 'offers screen');
  });

  // The browser-direct path adds four degraded screens and one generating
  // sentence per proof-port source. Every one of them is copy a user reads,
  // so every one of them is scanned too.
  const laceReasons: readonly ApiFailureReason[] = [
    'wallet_absent',
    'wallet_locked',
    'wallet_wrong_network',
    'proof_server_unreachable',
  ];

  it.each(laceReasons)('degraded screen, reason %s', (reason) => {
    assertSpanishOnly(
      renderProofScreen(buildIdentityContent(settleDegraded<boolean>(reason), 10_000), buildStepProgress(1, 4, 'x')),
      `identity screen, ${reason}`,
    );
    assertSpanishOnly(
      renderProofScreen(buildBackingContent(settleDegraded<Tier>(reason), 10_000), buildStepProgress(2, 4, 'x')),
      `backing screen, ${reason}`,
    );
  });

  const sources: readonly PortSource[] = ['stub', 'real', 'bridge', 'lace'];

  it.each(sources)('generating copy for the %s source', (source) => {
    assertSpanishOnly(generatingBodyFor(source), `generating copy, ${source}`);
  });
});

// The help centre ships the same way the screens do, so it is held to the
// same rule: Spanish only, never mixed. Its keywords are not rendered, so
// only what actually reaches a page is scanned.
describe('the help centre is Spanish only too', () => {
  const pages: Array<readonly [string, string]> = [
    ['índice', renderHelpIndex()],
    ...HELP_CATEGORIES.map((category) => [category.slug, renderHelpCategory(category.slug)] as const),
    ...everyHelpArticle().map(
      ({ category, article }) =>
        [`${category.slug}/${article.slug}`, renderHelpArticle(category.slug, article.slug)] as const,
    ),
  ];

  it.each(pages)('%s', (label, html) => {
    assertSpanishOnly(html, `help ${label}`);
  });
});
