// proofScreen.ts
// Pure view-model builder shared by the identity and backing screens: turns
// a ProofState into copy and a single contextual CTA, with no DOM involved.

import type { ProofPhase } from '../domain/proofState';
import { formatElapsed } from '../domain/proofState';

export type CtaAction = 'start' | 'retry' | 'continue' | 'continue-anyway';

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
  readonly degradedBody: (value: T) => string;
}

const CTA_LABELS: Readonly<Record<CtaAction, string>> = {
  start: 'Start proof',
  retry: 'Retry',
  continue: 'Continue',
  'continue-anyway': 'Continue anyway',
};

export function buildProofScreenContent<T>(opts: BuildProofScreenOptions<T>): ProofScreenContent {
  const { phase, now, startedAt, value } = opts;

  if (phase === 'idle') {
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      statusHeading: 'Not started',
      statusBody: 'Press start to generate this proof. Nothing is sent yet.',
      ctaLabel: CTA_LABELS.start,
      ctaAction: 'start',
      ctaDisabled: false,
      synthetic: false,
    };
  }

  if (phase === 'generating') {
    const elapsed = startedAt === undefined ? '0s elapsed' : formatElapsed(startedAt, now);
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      statusHeading: `Generating your proof… ${elapsed}`,
      statusBody:
        'This runs entirely on this device and takes tens of seconds — verifying a signed attestation and evaluating a predicate, without revealing the underlying data.',
      ctaLabel: 'Generating…',
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
      statusHeading: 'Verification failed',
      statusBody: 'The proof did not verify. No partial data was disclosed. You can retry.',
      ctaLabel: CTA_LABELS.retry,
      ctaAction: 'retry',
      ctaDisabled: false,
      synthetic: true,
    };
  }

  // phase is 'ready' or 'degraded'; both require a settled value.
  if (value === undefined) {
    throw new Error(`proof phase "${phase}" requires a settled value`);
  }

  if (phase === 'degraded') {
    return {
      h1: opts.h1,
      intro: opts.intro,
      phase,
      statusHeading: 'Degraded — verified via fallback path',
      statusBody: opts.degradedBody(value),
      ctaLabel: CTA_LABELS['continue-anyway'],
      ctaAction: 'continue-anyway',
      ctaDisabled: false,
      synthetic: true,
    };
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
