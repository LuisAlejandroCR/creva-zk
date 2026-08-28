// identityContent.ts
// Copy for the "apply for the card" screen: wraps the shared proof builder
// with identity-specific text. The value is a plain boolean — the circuit
// discloses only the outcome, never the attestation it checked.

import type { ProofState } from '../domain/proofState';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';

export function buildIdentityContent(proof: ProofState<boolean>, now: number): ProofScreenContent {
  return buildProofScreenContent<boolean>({
    h1: 'Apply for the card',
    intro:
      'One proof: a signed identity attestation is verified, and a predicate — verified, of age, tax ID matches — is evaluated. Only the outcome leaves this device.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    readyHeading: () => '✓ Identity verified',
    readyBody: () => 'The predicate holds. No document, photo, or tax ID was disclosed to reach this result.',
    degradedBody: () =>
      'The predicate holds via a fallback verification path. Treat this as lower-confidence than a full verification.',
  });
}
