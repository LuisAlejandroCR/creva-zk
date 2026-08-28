// backingContent.ts
// Copy for the "see what you qualify for" screen: wraps the shared proof
// builder with backing-specific text. The value is the proven Tier only —
// never the collateral amount or balance behind it.

import { TIER_LABELS, type Tier } from '../domain/tier';
import type { ProofState } from '../domain/proofState';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';

export function buildBackingContent(proof: ProofState<Tier>, now: number): ProofScreenContent {
  return buildProofScreenContent<Tier>({
    h1: 'Descubre a qué calificas',
    intro:
      'Una prueba: el colateral se compara contra el límite solicitado dentro del circuito, y solo el nivel resultante sale de este dispositivo — nunca el monto del colateral ni el saldo de la cuenta.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    readyHeading: (tier) => `✓ Prueba de respaldo lista — ${TIER_LABELS[tier]}`,
    readyBody: () => 'El nivel de arriba es el único valor revelado. La siguiente pantalla dividida muestra qué significa eso.',
    degradedBody: (tier) =>
      `Se alcanzó el nivel ${TIER_LABELS[tier]} mediante una vía de verificación alterna. Trátalo como de menor confianza que una verificación completa.`,
  });
}
