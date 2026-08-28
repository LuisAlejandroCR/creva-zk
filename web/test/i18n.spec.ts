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
import {
  idleProof,
  settleDegraded,
  settleFailed,
  settleReady,
  startGenerating,
  type ProofState,
} from '../src/domain/proofState';
import type { Tier } from '../src/domain/tier';

// English words that would only appear here if a screen were left
// untranslated or a new one shipped without translation. Not an exhaustive
// dictionary — just the vocabulary this app's own copy would use in English.
// "selfie" is excluded: it's an accepted loanword in Mexican fintech Spanish
// (RAE-listed), not an English leak.
const ENGLISH_TELLS =
  /\b(the|and|your|proof|card|tier|start|continue|retry|ready|failed|degraded|step|offers|identity|backing|synthetic|generating|verified|verification|balance|bank|document|outcome)\b/i;

// class="…", data-role="…" etc. carry English identifiers by design (CSS
// hooks, not copy) — strip every tag so only visible text is scanned.
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
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
    settleDegraded(true),
  ];

  it.each(identityStates.map((state, i) => [i, state] as const))('identity screen, state %i', (_i, state) => {
    const html = renderProofScreen(buildIdentityContent(state, 10_000), 'Paso 1 de 4', 'ready');
    assertSpanishOnly(html, 'identity screen');
  });

  const backingStates: Array<ProofState<Tier>> = [
    idleProof<Tier>(),
    startGenerating<Tier>(0),
    settleFailed<Tier>(),
    settleReady<Tier>('silver'),
    settleDegraded<Tier>('gold'),
  ];

  it.each(backingStates.map((state, i) => [i, state] as const))('backing screen, state %i', (_i, state) => {
    const html = renderProofScreen(buildBackingContent(state, 10_000), 'Paso 2 de 4', 'ready');
    assertSpanishOnly(html, 'backing screen');
  });

  it('compare screen', () => {
    const html = renderCompareScreen(buildCompareContent(), 'Paso 3 de 4');
    assertSpanishOnly(html, 'compare screen');
  });

  it('offers screen', () => {
    const html = renderOffersScreen(buildOffersContent('gold'), 'Paso 4 de 4');
    assertSpanishOnly(html, 'offers screen');
  });
});
