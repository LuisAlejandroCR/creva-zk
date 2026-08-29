// proofScreen.ts
// Pure view-model builder shared by the identity and backing screens: turns
// a ProofState into plain-language copy, a staged wait, one contextual CTA
// and the help article this screen's ? leads to. A degraded proof renders
// the copy for its own reason where there is one, so "no wallet" and "your
// local proof server is down" are never the same screen — but it stays a
// degraded screen, never a rejection. No DOM involved.

import type { ApiFailureReason } from '@creva-zk/api';
import type { ProofPhase } from '../domain/proofState';
import { buildWaitProgress, type WaitProgress, type WaitStage } from '../domain/waitStages';

export type CtaAction = 'start' | 'retry' | 'continue';

export interface ProofScreenContent {
  readonly h1: string;
  readonly intro: string;
  readonly phase: ProofPhase;
  readonly statusHeading: string;
  readonly statusBody: string;
  /** Only while generating: the staged sequence that is the wait screen. */
  readonly wait?: WaitProgress;
  readonly ctaLabel: string;
  readonly ctaAction: CtaAction;
  readonly ctaDisabled: boolean;
  readonly synthetic: boolean;
  /** "category/article": where this screen's ? goes. Never empty — a ? that
   *  leads nowhere fails the build. */
  readonly help: string;
}

export interface BuildProofScreenOptions<T> {
  readonly h1: string;
  readonly intro: string;
  readonly phase: ProofPhase;
  readonly now: number;
  readonly startedAt?: number;
  readonly value?: T;
  // Only a degraded proof has one. Five of them get copy of their own; every
  // other reason falls through to degradedBody().
  readonly reason?: ApiFailureReason;
  // Where this proof is being generated. Optional, and the default is the
  // plain sentence every in-process source uses — saying the wrong thing
  // here would be a privacy claim the app cannot keep.
  readonly generatingBody?: string;
  /** What the button does before anything has run, in her words. */
  readonly startLabel: string;
  /** Where the button takes her once the answer is yes, in her words. */
  readonly continueLabel: string;
  /** Nothing has run yet: what she is about to do. */
  readonly idleBody: string;
  readonly stages: readonly WaitStage[];
  readonly readyHeading: (value: T) => string;
  readonly readyBody: (value: T) => string;
  /** The answer came back and it is no. */
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
export const DEFAULT_GENERATING_BODY = 'Tarda unos 24 segundos. No cierres esta pantalla.';

interface DegradedCopy {
  readonly heading: string;
  readonly body: string;
}

// The five the browser-direct path can tell apart before a proof is even
// attempted. Each names the single thing the user has to fix and nothing
// else — and none of them says she failed, because nobody checked anything.
const DEGRADED_COPY: Partial<Readonly<Record<ApiFailureReason, DegradedCopy>>> = {
  wallet_absent: {
    heading: 'Falta la cartera',
    body: 'Este navegador no tiene ninguna cartera de Midnight instalada, así que nadie pudo comprobar nada. Instala Lace en su versión Midnight Preview (publicada por IOG) y vuelve a intentarlo. Tus datos siguen sin salir de este dispositivo.',
  },
  wallet_locked: {
    heading: 'Cartera bloqueada',
    body: 'Lace está instalada pero no entregó una conexión, así que nadie pudo revisar nada. Ábrela, desbloquéala, autoriza este sitio y vuelve a intentarlo. Tus datos siguen sin salir de este dispositivo.',
  },
  wallet_wrong_network: {
    heading: 'Red equivocada',
    body: 'Lace está conectada a otra red, así que nadie pudo revisar nada. Cámbiala a la red de prueba de Midnight (preprod) y vuelve a intentarlo. Tus datos siguen sin salir de este dispositivo.',
  },
  proof_server_unreachable: {
    heading: 'El servidor local no responde',
    body: 'No respondió el servidor que configuraste en Lace (Ajustes » Midnight » Local, http://localhost:6300). Ahí se genera todo, en tu propia computadora: sin él nadie pudo comprobar nada, y tus datos siguieron sin viajar a ningún lado. Inícialo y vuelve a intentarlo.',
  },
  // Not her problem to fix, and the copy says so: whoever installed this app
  // pointed it at a place where nothing is set up. Everything else on this
  // list asks her to do something; this one asks her to tell someone.
  contract_not_found: {
    heading: 'Falta un dato de esta app',
    body: 'A esta app le falta la dirección del lugar donde se hace la revisión, o ese lugar ya no está, así que nadie pudo revisar nada. No es algo que hayas hecho mal ni algo que puedas arreglar desde aquí: avísale a quien te compartió la app. Tus datos siguen sin salir de este dispositivo.',
  },
};

// Failed and degraded are different answers and never share a word. Degraded
// keeps the bare "Reintentar": nothing was decided, so there is nothing else
// to offer.
const FAILED_CTA_LABEL = 'Volver a intentarlo';
const DEGRADED_CTA_LABEL = 'Reintentar';

export function buildProofScreenContent<T>(opts: BuildProofScreenOptions<T>): ProofScreenContent {
  const { phase, now, startedAt, value } = opts;
  const shared = { h1: opts.h1, intro: opts.intro, phase, help: opts.help };

  if (phase === 'idle') {
    return {
      ...shared,
      statusHeading: 'Aún no empezamos',
      statusBody: opts.idleBody,
      ctaLabel: opts.startLabel,
      ctaAction: 'start',
      ctaDisabled: false,
      synthetic: false,
    };
  }

  if (phase === 'generating') {
    const wait = buildWaitProgress(opts.stages, startedAt === undefined ? 0 : now - startedAt);
    return {
      ...shared,
      // Stable while the stages below carry the changing story: the panel is
      // the frame, not the narrator.
      statusHeading: 'Trabajando en tu solicitud',
      statusBody: opts.generatingBody ?? DEFAULT_GENERATING_BODY,
      wait,
      // The wait is the screen; the button only says the work is still on.
      ctaLabel: 'Trabajando en tu teléfono…',
      ctaAction: 'start',
      ctaDisabled: true,
      synthetic: false,
    };
  }

  if (phase === 'failed') {
    return {
      ...shared,
      // The check ran and the answer is no — not a malfunction.
      statusHeading: 'Todavía no se puede',
      statusBody: opts.failedBody(),
      ctaLabel: FAILED_CTA_LABEL,
      ctaAction: 'retry',
      ctaDisabled: false,
      synthetic: true,
    };
  }

  if (phase === 'degraded') {
    const specific = opts.reason === undefined ? undefined : DEGRADED_COPY[opts.reason];
    const specificHelp = opts.reason === undefined ? undefined : opts.degradedHelp?.[opts.reason];
    return {
      ...shared,
      // The ? follows the reason: "falta la cartera" has an article of its
      // own, and sending her to the screen's general one would waste the tap.
      help: specificHelp ?? opts.help,
      // Not a rejection: nothing was checked, so the honest action is to try
      // again, never a way past a question nobody answered. That holds for
      // the five named reasons too — they only say what to fix.
      statusHeading: specific?.heading ?? 'Nadie pudo revisarlo',
      statusBody: specific?.body ?? opts.degradedBody(),
      ctaLabel: DEGRADED_CTA_LABEL,
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
    ...shared,
    statusHeading: opts.readyHeading(value),
    statusBody: opts.readyBody(value),
    ctaLabel: opts.continueLabel,
    ctaAction: 'continue',
    ctaDisabled: false,
    synthetic: true,
  };
}
