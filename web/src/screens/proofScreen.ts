// proofScreen.ts
// Pure view-model builder shared by the identity and backing screens: turns
// a ProofState into copy and a single contextual CTA, with no DOM involved.

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
  readonly readyHeading: (value: T) => string;
  readonly readyBody: (value: T) => string;
  // The predicate was evaluated and does not hold.
  readonly failedBody: () => string;
  // No value: a degraded proof has no outcome to describe.
  readonly degradedBody: () => string;
}

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
      statusBody:
        'Esto corre por completo en este dispositivo y toma decenas de segundos — se verifica una atestación firmada y se evalúa un predicado, sin revelar los datos subyacentes.',
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
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      // Not a rejection: nothing was evaluated, so the honest action is to
      // try again, never to continue as though the predicate had held.
      statusHeading: 'No pudimos verificarlo',
      statusBody: opts.degradedBody(),
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
