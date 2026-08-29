// proofScreen.ts
// Pure view-model builder shared by the identity and backing screens: turns
// a ProofState into copy and a single contextual CTA, with no DOM involved.
// A degraded proof renders the copy for its own reason where there is one,
// so "no wallet" and "your local proof server is down" are never the same
// screen — but it stays a degraded screen, never a rejection.

import type { ApiFailureReason } from '@creva-zk/api';
import type { ProofPhase } from '../domain/proofState';
import { formatElapsed } from '../domain/proofState';

export type CtaAction = 'start' | 'retry' | 'continue';

export interface ProofScreenContent {
  readonly h1: string;
  readonly intro: string;
  readonly phase: ProofPhase;
  readonly statusHeading: string;
  readonly statusBody: string;
  readonly ctaLabel: string;
  readonly ctaAction: CtaAction;
  readonly ctaDisabled: boolean;
  readonly synthetic: boolean;
}

export interface BuildProofScreenOptions<T> {
  readonly h1: string;
  readonly intro: string;
  readonly phase: ProofPhase;
  readonly now: number;
  readonly startedAt?: number;
  readonly value?: T;
  // Only a degraded proof has one. Four of them get copy of their own; every
  // other reason falls through to degradedBody().
  readonly reason?: ApiFailureReason;
  // Where this proof is being generated. Optional, and the default is the
  // sentence that shipped — saying the wrong thing here would be a privacy
  // claim the app cannot keep.
  readonly generatingBody?: string;
  readonly readyHeading: (value: T) => string;
  readonly readyBody: (value: T) => string;
  // The predicate was evaluated and does not hold.
  readonly failedBody: () => string;
  // No value: a degraded proof has no outcome to describe.
  readonly degradedBody: () => string;
}

// True for every source that proves through a process this app itself
// started, on this machine. proofProvenance.ts overrides it for the
// browser-direct path, which proves against a server the user configured.
export const DEFAULT_GENERATING_BODY =
  'Esto corre por completo en este dispositivo y toma decenas de segundos — se verifica una atestación firmada y se evalúa un predicado, sin revelar los datos subyacentes.';

interface DegradedCopy {
  readonly heading: string;
  readonly body: string;
}

// The four the browser-direct path can tell apart before a proof is even
// attempted. Each names the single thing the user has to fix and nothing
// else — and none of them says she failed, because nothing was evaluated.
const DEGRADED_COPY: Partial<Readonly<Record<ApiFailureReason, DegradedCopy>>> = {
  wallet_absent: {
    heading: 'Falta la cartera',
    body: 'Este navegador no tiene ninguna cartera de Midnight instalada, así que nadie pudo comprobar nada. Instala Lace en su versión Midnight Preview (publicada por IOG) y vuelve a intentarlo. Tus datos siguen sin salir de este dispositivo.',
  },
  wallet_locked: {
    heading: 'Cartera bloqueada',
    body: 'Lace está instalada pero no entregó una conexión, así que no se evaluó nada. Ábrela, desbloquéala, autoriza este sitio y vuelve a intentarlo. Tus datos siguen sin salir de este dispositivo.',
  },
  wallet_wrong_network: {
    heading: 'Red equivocada',
    body: 'Lace está conectada a otra red, así que no se evaluó nada. Cámbiala a la red de prueba de Midnight (preprod) y vuelve a intentarlo. Tus datos siguen sin salir de este dispositivo.',
  },
  proof_server_unreachable: {
    heading: 'El servidor local no responde',
    body: 'No respondió el servidor que configuraste en Lace (Ajustes » Midnight » Local, http://localhost:6300). Ahí se genera todo, en tu propia computadora: sin él nadie pudo comprobar nada, y tus datos siguieron sin viajar a ningún lado. Inícialo y vuelve a intentarlo.',
  },
};

const CTA_LABELS: Readonly<Record<CtaAction, string>> = {
  start: 'Iniciar prueba',
  retry: 'Reintentar',
  continue: 'Continuar',
};

export function buildProofScreenContent<T>(opts: BuildProofScreenOptions<T>): ProofScreenContent {
  const { phase, now, startedAt, value } = opts;

  if (phase === 'idle') {
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      statusHeading: 'Sin iniciar',
      statusBody: 'Presiona iniciar para generar esta prueba. Todavía no se envía nada.',
      ctaLabel: CTA_LABELS.start,
      ctaAction: 'start',
      ctaDisabled: false,
      synthetic: false,
    };
  }

  if (phase === 'generating') {
    const elapsed = startedAt === undefined ? '0 s transcurridos' : formatElapsed(startedAt, now);
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      statusHeading: `Generando tu prueba… ${elapsed}`,
      statusBody: opts.generatingBody ?? DEFAULT_GENERATING_BODY,
      ctaLabel: 'Generando…',
      ctaAction: 'start',
      ctaDisabled: true,
      synthetic: false,
    };
  }

  if (phase === 'failed') {
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      // The proof ran and the answer is no — not a malfunction.
      statusHeading: 'El requisito no se cumple',
      statusBody: opts.failedBody(),
      ctaLabel: CTA_LABELS.retry,
      ctaAction: 'retry',
      ctaDisabled: false,
      synthetic: true,
    };
  }

  if (phase === 'degraded') {
    const specific = opts.reason === undefined ? undefined : DEGRADED_COPY[opts.reason];
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      // Not a rejection: nothing was evaluated, so the honest action is to
      // try again, never to continue as though the predicate had held. That
      // holds for the four named reasons too — they only say what to fix.
      statusHeading: specific?.heading ?? 'No pudimos verificarlo',
      statusBody: specific?.body ?? opts.degradedBody(),
      ctaLabel: CTA_LABELS.retry,
      ctaAction: 'retry',
      ctaDisabled: false,
      synthetic: true,
    };
  }

  // Only a ready proof carries a value.
  if (value === undefined) {
    throw new Error(`proof phase "${phase}" requires a settled value`);
  }

  return {
    h1: opts.h1,
    intro: opts.intro,
    phase,
    statusHeading: opts.readyHeading(value),
    statusBody: opts.readyBody(value),
    ctaLabel: CTA_LABELS.continue,
    ctaAction: 'continue',
    ctaDisabled: false,
    synthetic: true,
  };
}
