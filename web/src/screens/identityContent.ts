// identityContent.ts
// Copy for the "apply for the card" screen: wraps the shared proof builder
// with identity-specific text. The value is a plain boolean — the circuit
// discloses only the outcome, never the attestation it checked.

import type { ProofState } from '../domain/proofState';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';

export function buildIdentityContent(proof: ProofState<boolean>, now: number): ProofScreenContent {
  return buildProofScreenContent<boolean>({
    h1: 'Solicita la tarjeta',
    intro:
      'Una prueba: se verifica una atestación de identidad firmada y se evalúa un predicado — verificada, mayor de edad, RFC coincide. Solo el resultado sale de este dispositivo.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    readyHeading: () => '✓ Identidad verificada',
    readyBody: () => 'El predicado se cumple. No se reveló ningún documento, foto ni RFC para llegar a este resultado.',
    degradedBody: () =>
      'El predicado se cumple mediante una vía de verificación alterna. Trátalo como de menor confianza que una verificación completa.',
  });
}
