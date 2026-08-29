// proofScreen.ts
// Pure view-model builder shared by the identity and backing screens: turns
// a ProofState into the archetype that state should be seen in, the copy for
// it, at most one action, and the help article its ? leads to. No DOM.
//
// The archetype is the point. The same four states used to render as one
// layout with different words in the same cards; each one now has a shape of
// its own — an invitation, work in flight, an answer, or a way forward —
// while every screen keeps the same components, spacing and palette.
//
// A degraded proof renders the copy for its own reason where there is one,
// so "no wallet" and "your local proof server is down" are never the same
// screen — but it stays a degraded screen, never a rejection.

import type { ApiFailureReason } from '@creva-zk/api';
import type { ProofPhase } from '../domain/proofState';
import {
  OVERTIME_HEADING,
  OVERTIME_LEDE,
  WAIT_PROMISE,
  buildWaitProgress,
  type WaitProgress,
  type WaitStage,
} from '../domain/waitStages';
import type { ScreenArchetype, StatusTone, SecurityNoticeOptions } from '../ui';

export type CtaAction = 'start' | 'retry' | 'continue';

export interface ProofScreenContent {
  readonly archetype: ScreenArchetype;
  readonly phase: ProofPhase;
  /** The dominant line on the screen, and the only h1 on it. */
  readonly title: string;
  /** One or two short sentences under the title. */
  readonly lede: string;
  /** Only where an answer has arrived: what it means, in one line. */
  readonly body?: string;
  readonly tone?: StatusTone;
  /** Only while verifying: the staged sequence that is the screen. */
  readonly wait?: WaitProgress;
  /** Absent while verifying — there is nothing for her to do but wait. */
  readonly ctaLabel?: string;
  readonly ctaAction?: CtaAction;
  readonly ctaDisabled: boolean;
  readonly synthetic: boolean;
  /** Only where the state is about her data being handled. */
  readonly security?: SecurityNoticeOptions;
  /** "category/article": where this screen's ? goes. Never empty — a ? that
   *  leads nowhere fails the build. */
  readonly help: string;
  /** Only where the state's whole question is why it happened: a second
   *  action for it, beside the ? every screen already carries. */
  readonly askWhy: boolean;
}

export interface BuildProofScreenOptions<T> {
  readonly phase: ProofPhase;
  readonly now: number;
  readonly startedAt?: number;
  readonly value?: T;
  // Only a degraded proof has one. Four of them get copy of their own; every
  // other reason falls through to degradedBody().
  readonly reason?: ApiFailureReason;
  /** Nothing has run yet: what this step is, and what she is about to do. */
  readonly introTitle: string;
  readonly introLede: string;
  /** Work in flight: what her phone is doing, named as the thing itself. */
  readonly verifyingTitle: string;
  // Where this proof is being generated. Optional, and the default is the
  // plain sentence every in-process source uses — saying the wrong thing
  // here would be a privacy claim the app cannot keep.
  readonly verifyingLede?: string;
  /** What the button does before anything has run, in her words. */
  readonly startLabel: string;
  /** Where the button takes her once the answer is yes, in her words. */
  readonly continueLabel: string;
  readonly stages: readonly WaitStage[];
  readonly readyTitle: (value: T) => string;
  /** The answer itself, in one short line. */
  readonly readyLede: (value: T) => string;
  /** What it cost her to get it — which here is nothing. */
  readonly readyBody: (value: T) => string;
  /** The answer came back and it is no. */
  readonly failedTitle: string;
  readonly failedBody: () => string;
  /** No value: nobody could check, so there is no answer to describe. */
  readonly degradedBody: () => string;
  /** The article that answers this screen. */
  readonly help: string;
  /** An article per degraded reason, where one says more than the screen's
   *  own. Anything not listed keeps the screen's article. */
  readonly degradedHelp?: Readonly<Partial<Record<ApiFailureReason, string>>>;
}

// True for every source that proves through a process this app itself
// started, on this machine. proofProvenance.ts overrides it for the
// browser-direct path, which proves against a server the user configured.
export const DEFAULT_VERIFYING_LEDE = 'Tu teléfono está haciendo la revisión. No cierres esta pantalla.';

interface DegradedCopy {
  readonly title: string;
  readonly body: string;
}

// The four the browser-direct path can tell apart before a proof is even
// attempted. Each names the single thing the user has to fix and nothing
// else — and none of them says she failed, because nobody checked anything.
// The recover archetype gives the fix the room the old card had to spend on
// repeating the promise, so these are shorter than they were and say more.
const DEGRADED_COPY: Partial<Readonly<Record<ApiFailureReason, DegradedCopy>>> = {
  wallet_absent: {
    title: 'Falta la cartera',
    body: 'Este navegador no tiene ninguna cartera de Midnight instalada, así que nadie pudo comprobar nada. Instala Lace en su versión Midnight Preview y vuelve a intentarlo.',
  },
  wallet_locked: {
    title: 'Cartera bloqueada',
    body: 'Lace está instalada pero no entregó una conexión, así que nadie pudo revisar nada. Ábrela, desbloquéala, autoriza este sitio y vuelve a intentarlo.',
  },
  wallet_wrong_network: {
    title: 'Red equivocada',
    body: 'Lace está conectada a otra red, así que nadie pudo revisar nada. Cámbiala a la red de prueba de Midnight (preprod) y vuelve a intentarlo.',
  },
  proof_server_unreachable: {
    title: 'El servidor local no responde',
    body: 'No respondió el servidor que configuraste en Lace (Ajustes » Midnight » Local, http://localhost:6300). Ahí se genera todo, en tu propia computadora: sin él nadie pudo comprobar nada. Inícialo y vuelve a intentarlo.',
  },
};

// Failed and degraded are different answers and never share a word. Degraded
// keeps the bare "Reintentar": nothing was decided, so there is nothing else
// to offer.
const FAILED_CTA_LABEL = 'Volver a intentarlo';
const DEGRADED_CTA_LABEL = 'Reintentar';

const DEGRADED_TITLE = 'No pudimos terminar la revisión';

export function buildProofScreenContent<T>(opts: BuildProofScreenOptions<T>): ProofScreenContent {
  const { phase, now, startedAt, value } = opts;

  if (phase === 'idle') {
    return {
      archetype: 'intro',
      phase,
      title: opts.introTitle,
      lede: opts.introLede,
      ctaLabel: opts.startLabel,
      ctaAction: 'start',
      ctaDisabled: false,
      synthetic: false,
      // This is the step where she decides to hand something over, so this is
      // where the promise belongs — not on every screen after it.
      security: { message: WAIT_PROMISE, help: opts.help },
      help: opts.help,
      askWhy: false,
    };
  }

  if (phase === 'generating') {
    const wait = buildWaitProgress(opts.stages, startedAt === undefined ? 0 : now - startedAt);
    return {
      archetype: 'verifying',
      phase,
      // Past the measured run the screen stops narrating the work and starts
      // saying she has nothing to do. Same region, patched in place.
      title: wait.overtime ? OVERTIME_HEADING : opts.verifyingTitle,
      lede: wait.overtime ? OVERTIME_LEDE : (opts.verifyingLede ?? DEFAULT_VERIFYING_LEDE),
      wait,
      // No action: the wait is the screen, and a disabled button saying
      // "trabajando…" only repeated what the ring already shows.
      ctaDisabled: false,
      synthetic: false,
      security: { message: WAIT_PROMISE, help: opts.help },
      help: opts.help,
      askWhy: false,
    };
  }

  if (phase === 'failed') {
    return {
      archetype: 'recover',
      phase,
      // The check ran and the answer is no — not a malfunction.
      title: opts.failedTitle,
      lede: 'No pasa nada. Puedes intentarlo de nuevo.',
      body: opts.failedBody(),
      tone: 'warning',
      ctaLabel: FAILED_CTA_LABEL,
      ctaAction: 'retry',
      ctaDisabled: false,
      synthetic: true,
      help: opts.help,
      // The whole question this screen raises is why, so the answer to it is
      // a real second action rather than the same ? as every other screen.
      askWhy: true,
    };
  }

  if (phase === 'degraded') {
    const specific = opts.reason === undefined ? undefined : DEGRADED_COPY[opts.reason];
    const specificHelp = opts.reason === undefined ? undefined : opts.degradedHelp?.[opts.reason];
    return {
      archetype: 'recover',
      phase,
      // Not a rejection: nothing was checked, so the honest action is to try
      // again, never a way past a question nobody answered. That holds for
      // the four named reasons too — they only say what to fix.
      title: specific?.title ?? DEGRADED_TITLE,
      lede: 'No pasa nada. Puedes intentarlo de nuevo.',
      body: specific?.body ?? opts.degradedBody(),
      tone: 'error',
      ctaLabel: DEGRADED_CTA_LABEL,
      ctaAction: 'retry',
      ctaDisabled: false,
      synthetic: true,
      // The ? follows the reason: "falta la cartera" has an article of its
      // own, and sending her to the screen's general one would waste the tap.
      help: specificHelp ?? opts.help,
      askWhy: true,
    };
  }

  // Only a ready proof carries a value.
  if (value === undefined) {
    throw new Error(`proof phase "${phase}" requires a settled value`);
  }

  return {
    archetype: 'confirm',
    phase,
    title: opts.readyTitle(value),
    lede: opts.readyLede(value),
    body: opts.readyBody(value),
    tone: 'success',
    ctaLabel: opts.continueLabel,
    ctaAction: 'continue',
    ctaDisabled: false,
    synthetic: true,
    help: opts.help,
    askWhy: false,
  };
}
