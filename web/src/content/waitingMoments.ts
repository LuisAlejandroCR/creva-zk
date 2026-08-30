// waitingMoments.ts
// The copy and the cadence of the micro-moments that live inside a wait.
// Nothing here renders: it says what each moment means, which visual carries
// it, and when in the processing period it is cued.
//
// The journey has four steps but only two processing periods — the identity
// proof and the backing proof, each about 23.7s — so the four-beat arc is
// scheduled inside those two waits rather than after a step. No moment is
// ever triggered by a tap, and none of them lengthens the journey by a
// millisecond: a cue that has not fired by the time the answer lands is
// dropped.

export type ProgressMomentVariant =
  | 'discovery' // one figure, with its source on screen
  | 'encouragement' // momentum, said back to her
  | 'structural' // what is still ahead, framed as progress
  | 'celebration'; // the answer arriving

/** Which illustration carries the moment. The picture is the message; the
 *  copy underneath is its caption. */
export type MomentVisual = 'door' | 'wheel' | 'assembling' | 'burst';

export interface ProgressMoment {
  /** Position in the arc, 1-based. Not a journey step: see the cues below. */
  readonly order: number;
  readonly variant: ProgressMomentVariant;
  readonly visual: MomentVisual;
  /** Two or three words. Uppercased by the stylesheet, not by the string. */
  readonly eyebrow: string;
  /** Two to four words. It is a caption, not a headline. */
  readonly title: string;
  /** One sentence, and it has to fit two lines at 320px. */
  readonly body: string;
  /** Where the figure comes from, as it appears on screen. Required wherever
   *  the body states a figure, and meaningless without one — a test enforces
   *  both directions. */
  readonly source?: string;
  /** The structural moment shows where she is in the journey instead of
   *  telling her what she failed to hand over. */
  readonly showsChecklist?: boolean;
}

// The one figure this journey publishes.
//
// INEGI, Comunicado de prensa 62/25, ENAFIN 2024,
// 28 de mayo de 2025.
// https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/enafin/ENAFIN_24.pdf
//
// The verb is the bulletin's own — "ha tenido financiamiento" — and not the
// chart's, which says "solicitado". Having asked and having had are not the
// same measure. The subject is likewise the bulletin's: a woman who is the
// majority owner or partner, which "empresas lideradas por mujeres" would
// quietly widen. The space before the percent sign is a non-breaking one so
// the figure never wraps away from its unit.
const ENAFIN_FIGURE =
  '42.3 % de las empresas donde una mujer es dueña o socia mayoritaria ha tenido financiamiento.';

export const PROGRESS_MOMENTS: readonly ProgressMoment[] = [
  {
    order: 1,
    variant: 'discovery',
    visual: 'door',
    eyebrow: 'Un dato',
    title: 'El acceso todavía importa',
    body: ENAFIN_FIGURE,
    source: 'INEGI · ENAFIN 2024',
  },
  {
    order: 2,
    variant: 'encouragement',
    visual: 'wheel',
    eyebrow: 'Vas avanzando',
    title: 'Ya estás más cerca',
    body: 'Cada dato que completas ayuda a construir tu perfil.',
  },
  {
    order: 3,
    variant: 'structural',
    visual: 'assembling',
    eyebrow: 'Casi listo',
    title: 'Solo falta un poco',
    body: 'Te mostramos qué falta para completar tu perfil.',
    showsChecklist: true,
  },
  {
    order: 4,
    variant: 'celebration',
    visual: 'burst',
    eyebrow: 'Listo',
    title: 'Lo conseguimos',
    body: 'Tu información ya está preparada para el siguiente paso.',
  },
];

export function momentByOrder(order: number): ProgressMoment | undefined {
  return PROGRESS_MOMENTS.find((moment) => moment.order === order);
}

/** The two steps of the journey that make the user wait for anything. */
export type WaitKind = 'identity' | 'backing';

/**
 * When a moment is cued.
 *
 * `processing` — while the proof is running, this far into it. If the answer
 *   arrives first the cue is dropped: the moment never delays the journey.
 * `settled` — the instant the answer lands, which is the close of the same
 *   waiting experience. Only the celebration uses it, because "listo" said
 *   while a bar reads 81 % would be a lie, and this journey does not tell
 *   that one.
 */
export type MomentCuePhase = 'processing' | 'settled';

export interface MomentCue {
  readonly order: number;
  readonly wait: WaitKind;
  readonly phase: MomentCuePhase;
  /** Milliseconds into the processing period, or — for a settled cue — after
   *  the answer landed. */
  readonly afterMs: number;
}

// Early enough that the wait never feels empty, and far enough apart that two
// moments are never on screen together or read as one running commentary.
export const MOMENT_CUES: readonly MomentCue[] = [
  { order: 1, wait: 'identity', phase: 'processing', afterMs: 1_400 },
  { order: 2, wait: 'identity', phase: 'processing', afterMs: 12_000 },
  { order: 3, wait: 'backing', phase: 'processing', afterMs: 1_400 },
  // 700ms after the answer, not on top of it: the tier badge's own reveal is
  // a 240ms delay plus a 420ms landing, and the answer she waited for gets to
  // arrive and be seen before anything congratulates her on it.
  { order: 4, wait: 'backing', phase: 'settled', afterMs: 700 },
];

export function cuesFor(wait: WaitKind, phase: MomentCuePhase): readonly MomentCue[] {
  return MOMENT_CUES.filter((cue) => cue.wait === wait && cue.phase === phase);
}
