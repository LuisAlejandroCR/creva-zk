// backingContent.ts
// Copy for the "see what you qualify for" screen: wraps the shared proof
// builder with backing-specific text. The value is the proven Tier only —
// never the collateral amount or balance behind it.

import { TIER_LABELS, type Tier } from '../domain/tier';
import type { ProofState } from '../domain/proofState';
import { activePortSource } from '../proofPort';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';
import { generatingBodyFor } from './proofProvenance';

export function buildBackingContent(proof: ProofState<Tier>, now: number): ProofScreenContent {
  return buildProofScreenContent<Tier>({
    h1: 'Descubre a qué calificas',
    intro:
      'Una prueba: el colateral se compara contra el límite solicitado dentro del circuito, y solo el nivel resultante sale de este dispositivo — nunca el monto del colateral ni el saldo de la cuenta.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    reason: proof.reason,
    generatingBody: generatingBodyFor(activePortSource()),
    readyHeading: (tier) => `✓ Prueba de respaldo lista — ${TIER_LABELS[tier]}`,
    readyBody: () => 'El nivel de arriba es el único valor revelado. La siguiente pantalla dividida muestra qué significa eso.',
    failedBody: () =>
      'Tu colateral no alcanza el límite solicitado. El circuito revela solo ese desenlace, nunca el monto de tu colateral ni tu saldo.',
    degradedBody: () =>
      'El servicio de pruebas no respondió, así que no se evaluó tu respaldo. Esto no significa que no califiques: significa que no lo sabemos. Tu colateral y tu saldo siguen sin salir de este dispositivo.',
  });
}
