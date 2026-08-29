// identityContent.ts
// Copy for the "apply for the card" screen. Plain language throughout: the
// explanation lives in the help centre, one tap away, and never in the flow.
// The value is a plain boolean — only the outcome is ever disclosed, never
// what was checked to reach it.

import type { ProofState } from '../domain/proofState';
import type { WaitStage } from '../domain/waitStages';
import { activePortSource } from '../proofPort';
import { helpPath } from '../help/helpContent';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';
import { generatingBodyFor } from './proofProvenance';

// Paced against the measured 23.7s run, so each line is on screen long
// enough to read and the last one lands with the answer.
const IDENTITY_STAGES: readonly WaitStage[] = [
  {
    label: 'Abriendo tu identificación aquí, en tu teléfono',
    detail: 'No se sube a ningún servidor. Se queda en este dispositivo.',
    startFraction: 0,
  },
  {
    label: 'Comprobando que la emitió quien dice haberla emitido',
    detail: 'Se revisa la firma del emisor sin mandarle tu identificación a nadie.',
    startFraction: 0.14,
  },
  {
    label: 'Confirmando que eres mayor de edad y que tu RFC coincide',
    detail: 'La comparación se hace aquí mismo. Tus datos no se copian a ningún lado.',
    startFraction: 0.42,
  },
  {
    label: 'Guardando solo la respuesta: sí o no',
    detail: 'Ni tu nombre, ni tu foto, ni tu RFC salen junto con ella.',
    startFraction: 0.72,
  },
];

export function buildIdentityContent(proof: ProofState<boolean>, now: number): ProofScreenContent {
  return buildProofScreenContent<boolean>({
    h1: 'Solicita tu tarjeta',
    intro:
      'Para empezar hay que saber que eres tú. Tu identificación se revisa aquí, en tu teléfono, y de aquí no sale: lo único que se comparte es un sí o un no.',
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    reason: proof.reason,
    generatingBody: generatingBodyFor(activePortSource()),
    startLabel: 'Solicita la tarjeta',
    continueLabel: 'Ver a qué califico',
    idleBody:
      'Cuando toques el botón, tu teléfono empieza a revisar tu identificación. Tarda unos 24 segundos y no envía nada.',
    stages: IDENTITY_STAGES,
    readyHeading: () => '✓ Listo, eres tú',
    readyBody:
      () => 'Nadie vio tu identificación, tu foto ni tu RFC. Solo quedó la respuesta: sí.',
    failedBody: () =>
      'Con esta identificación todavía no se puede seguir. No se dice cuál de los requisitos faltó, ni siquiera a nosotros.',
    degradedBody: () =>
      'El servicio que hace la revisión no contestó, así que nadie pudo comprobar tu identidad. Esto no quiere decir que no califiques: quiere decir que no lo sabemos. Tus datos siguen aquí, en tu teléfono.',
    help: helpPath('privacidad', 'que-ve-creva'),
    degradedHelp: {
      call_failed: helpPath('problemas', 'nadie-pudo-revisar'),
      wallet_absent: helpPath('problemas', 'falta-la-cartera'),
      wallet_locked: helpPath('problemas', 'cartera-bloqueada'),
      wallet_wrong_network: helpPath('problemas', 'red-equivocada'),
      proof_server_unreachable: helpPath('problemas', 'servidor-local'),
    },
  });
}
