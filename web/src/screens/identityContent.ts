// identityContent.ts
// Copy for the "apply for the card" screen, one line per archetype. Plain
// language throughout: the explanation lives in the help centre, one tap
// away, and never in the flow. The value is a plain boolean — only the
// outcome is ever disclosed, never what was checked to reach it.

import type { ProofState } from '../domain/proofState';
import type { WaitStage } from '../domain/waitStages';
import { activePortSource } from '../proofPort';
import { helpPath } from '../help/helpContent';
import { buildProofScreenContent, type ProofScreenContent } from './proofScreen';
import { verifyingLedeFor } from './proofProvenance';

// Paced against the measured 23.7s run, so each line is on screen long
// enough to read and the last one lands with the answer. The labels are
// short because they are a checklist now, not paragraphs: what makes each
// one safe is the detail line, and only the running step shows it.
const IDENTITY_STAGES: readonly WaitStage[] = [
  {
    label: 'Abriendo tu identificación en tu teléfono',
    detail: 'No se sube a ningún servidor. Se queda en este dispositivo.',
    startFraction: 0,
  },
  {
    label: 'Comprobando quién la emitió',
    detail: 'Se revisa la firma del emisor sin mandarle tu identificación a nadie.',
    startFraction: 0.14,
  },
  {
    label: 'Confirmando tu edad y tu RFC',
    detail: 'La comparación se hace aquí mismo. Tus datos no se copian a ningún lado.',
    startFraction: 0.42,
  },
  {
    label: 'Guardando solo la respuesta',
    detail: 'Ni tu nombre, ni tu foto, ni tu RFC salen junto con ella.',
    startFraction: 0.72,
  },
];

export function buildIdentityContent(proof: ProofState<boolean>, now: number): ProofScreenContent {
  return buildProofScreenContent<boolean>({
    phase: proof.phase,
    now,
    startedAt: proof.startedAt,
    value: proof.value,
    reason: proof.reason,
    introTitle: 'Solicita tu tarjeta',
    introLede:
      'Primero comprobamos que eres tú. Tu identificación se revisa aquí, en tu teléfono, y de aquí solo sale un sí o un no.',
    verifyingTitle: 'Revisando tu identificación',
    verifyingLede: verifyingLedeFor(activePortSource()),
    startLabel: 'Solicita la tarjeta',
    continueLabel: 'Ver a qué califico',
    stages: IDENTITY_STAGES,
    readyTitle: () => 'Listo, eres tú',
    readyLede: () => 'Confirmamos tu identidad.',
    readyBody: () =>
      'No tuvimos que enviar tu identificación, tu foto ni tu RFC para comprobarlo.',
    failedTitle: 'Todavía no se puede',
    failedBody: () =>
      'Con esta identificación todavía no se puede seguir. No se dice cuál de los requisitos faltó, ni siquiera a nosotros.',
    degradedBody: () =>
      'Nadie pudo comprobar tu identidad porque el servicio que hace la revisión no contestó. Esto no quiere decir que no califiques. Tus datos siguen aquí, en tu teléfono.',
    help: helpPath('privacidad', 'que-ve-creva'),
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
