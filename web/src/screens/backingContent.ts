// backingContent.ts
// Copy for the "see what you qualify for" screen, one line per archetype.
// Plain language throughout: the explanation lives in the help centre, one
// tap away, and never in the flow. The value is the proven Tier only — never
// the collateral amount or the account balance behind it.

import { TIER_LABELS, type Tier } from '../domain/tier';
import type { ProofState } from '../domain/proofState';
import type { WaitStage } from '../domain/waitStages';
import { activePortSource } from '../proofPort';
import { helpPath } from '../help/helpContent';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';
import { verifyingLedeFor } from './proofProvenance';

// Same pacing as the identity wait: fractions of the measured 23.7s run.
const BACKING_STAGES: readonly WaitStage[] = [
  {
    label: 'Leyendo tu respaldo en tu teléfono',
    detail: 'Tu saldo no se sube a ningún servidor. Se queda en este dispositivo.',
    startFraction: 0,
  },
  {
    label: 'Comparándolo con el límite que pediste',
    detail: 'La cuenta se hace aquí. Nadie ve cuánto tienes.',
    startFraction: 0.14,
  },
  {
    label: 'Viendo en qué nivel quedas',
    detail: 'Del resultado solo se guarda el nivel, nunca el monto.',
    startFraction: 0.42,
  },
  {
    label: 'Sellando el nivel',
    detail: 'Ni tu saldo ni tu respaldo salen junto con él.',
    startFraction: 0.72,
  },
];

export function buildBackingContent(proof: ProofState<Tier>, now: number): ProofScreenContent {
  return buildProofScreenContent<Tier>({
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    reason: proof.reason,
    introTitle: 'Descubre a qué calificas',
    introLede:
      'Ahora toca ver de cuánto puede ser tu tarjeta. La cuenta se hace aquí, en tu teléfono, y de aquí solo sale el nivel: nunca cuánto tienes.',
    verifyingTitle: 'Revisando tu respaldo',
    verifyingLede: verifyingLedeFor(activePortSource()),
    startLabel: 'Ver a qué califico',
    continueLabel: 'Ver qué compartí',
    stages: BACKING_STAGES,
    readyTitle: (tier) => `Calificas en nivel ${TIER_LABELS[tier]}`,
    readyLede: () => 'Ese nivel es lo único que se compartió.',
    readyBody: () => 'Cuánto tienes de respaldo sigue siendo solo tuyo.',
    failedTitle: 'Todavía no alcanza',
    failedBody: () =>
      'Tu respaldo todavía no alcanza para el límite que pediste. Nadie vio de cuánto es: solo que aún no llega.',
    degradedBody: () =>
      'Nadie pudo revisar tu respaldo porque el servicio que hace la revisión no contestó. Esto no quiere decir que no califiques. Tu saldo sigue aquí, en tu teléfono.',
    help: helpPath('privacidad', 'sin-ver-mi-saldo'),
    degradedHelp: {
      call_failed: helpPath('problemas', 'nadie-pudo-revisar'),
      wallet_absent: helpPath('problemas', 'falta-la-cartera'),
      wallet_locked: helpPath('problemas', 'cartera-bloqueada'),
      wallet_wrong_network: helpPath('problemas', 'red-equivocada'),
      proof_server_unreachable: helpPath('problemas', 'servidor-local'),
      contract_not_found: helpPath('problemas', 'falta-un-dato'),
    },
  });
}
