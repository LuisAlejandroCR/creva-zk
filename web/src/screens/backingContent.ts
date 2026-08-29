// backingContent.ts
// Copy for the "see what you qualify for" screen. Plain language above, the
// exact technical claim inside the disclosure. The value is the proven Tier
// only — never the collateral amount or the account balance behind it.

import { TIER_LABELS, type Tier } from '../domain/tier';
import type { ProofState } from '../domain/proofState';
import type { WaitStage } from '../domain/waitStages';
import { activePortSource } from '../proofPort';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';
import { generatingBodyFor } from './proofProvenance';

// Same pacing as the identity wait: fractions of the measured 23.7s run.
const BACKING_STAGES: readonly WaitStage[] = [
  {
    label: 'Leyendo tu respaldo aquí, en tu teléfono',
    detail: 'Tu saldo no se sube a ningún servidor. Se queda en este dispositivo.',
    startFraction: 0,
  },
  {
    label: 'Comparándolo con el límite que pediste',
    detail: 'La cuenta se hace aquí. Nadie ve cuánto tienes.',
    startFraction: 0.14,
  },
  {
    label: 'Viendo en qué nivel quedas: Bronce, Plata u Oro',
    detail: 'Del resultado solo se guarda el nivel, nunca el monto.',
    startFraction: 0.42,
  },
  {
    label: 'Sellando el nivel para que nadie pueda abrirlo',
    detail: 'Ni tu saldo ni tu respaldo salen junto con él.',
    startFraction: 0.72,
  },
];

export function buildBackingContent(proof: ProofState<Tier>, now: number): ProofScreenContent {
  return buildProofScreenContent<Tier>({
    h1: 'Descubre a qué calificas',
    intro:
      'Ahora toca ver de cuánto puede ser tu tarjeta. Tu respaldo se compara con lo que pediste aquí, en tu teléfono, y de aquí solo sale el nivel: nunca cuánto tienes.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    reason: proof.reason,
    generatingBody: generatingBodyFor(activePortSource()),
    startLabel: 'Ver a qué califico',
    continueLabel: 'Ver qué compartí',
    idleBody:
      'Cuando toques el botón, tu teléfono compara tu respaldo con el límite que pediste. Tarda unos 24 segundos y no envía tu saldo.',
    stages: BACKING_STAGES,
    readyHeading: (tier) => `✓ Calificas en nivel ${TIER_LABELS[tier]}`,
    readyBody: () =>
      'Ese nivel es lo único que se compartió. Cuánto tienes de respaldo sigue siendo solo tuyo.',
    failedBody: () =>
      'Tu respaldo todavía no alcanza para el límite que pediste. Nadie vio de cuánto es: solo que aún no llega.',
    degradedBody: () =>
      'El servicio que hace la revisión no contestó, así que nadie pudo revisar tu respaldo. Esto no quiere decir que no califiques: quiere decir que no lo sabemos. Tu saldo sigue aquí, en tu teléfono.',
    tech: {
      summary: 'Ver el detalle técnico',
      body:
        'El circuito <code>backing-tier</code> recibe como argumento público el límite solicitado. Dentro del circuito, el colateral entra como testigo privado y se compara contra ese límite y contra los umbrales de cada nivel. La prueba de conocimiento cero revela únicamente el nivel resultante — Sin nivel, Bronce, Plata u Oro — y nunca el monto del colateral, el saldo de la cuenta ni por cuánto se superó el umbral.',
    },
  });
}
