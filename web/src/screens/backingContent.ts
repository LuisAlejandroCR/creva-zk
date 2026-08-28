// backingContent.ts
// Copy for the "see what you qualify for" screen: wraps the shared proof
// builder with backing-specific text. The value is the proven Tier only —
// never the collateral amount or balance behind it.

import { TIER_LABELS, type Tier } from '../domain/tier';
import type { ProofState } from '../domain/proofState';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';

export function buildBackingContent(proof: ProofState<Tier>, now: number): ProofScreenContent {
  return buildProofScreenContent<Tier>({
    h1: 'See what you qualify for',
    intro:
      'One proof: collateral is compared against a requested limit inside the circuit, and only the resulting tier leaves this device — never the collateral amount or account balance.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    readyHeading: (tier) => `✓ Backing proof ready — ${TIER_LABELS[tier]}`,
    readyBody: () => 'The tier above is the only value disclosed. See the split screen next for what that means.',
    degradedBody: (tier) =>
      `The tier ${TIER_LABELS[tier]} was reached via a fallback verification path. Treat this as lower-confidence than a full verification.`,
  });
}
