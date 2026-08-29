// waitStages.ts
// The staged model behind the verification screen: turns elapsed
// milliseconds into the one step happening now, the beat a finished step
// holds its check for, a ring that advances with the measured run and a
// plain-language seconds readout. Pure and DOM-free, so the whole sequence
// is testable without waiting 24s.

export type WaitStageStatus = 'done' | 'active' | 'pending';

// End-to-end latency of one real proof, measured by
// tools/measure-proof-latency.sh. The stage boundaries below are fractions
// of it, so the sequence is paced by the real thing rather than invented.
export const MEASURED_PROOF_MS = 23_700;

// The ring never closes while the answer is still coming: the last sliver is
// the difference between "casi" and a claim we cannot make yet.
const MAX_PERCENT = 96;

// When a step's successor starts, the step that just finished stays on
// screen this long, wearing its check. That beat is the satisfying part of
// the wait and the only moment a completed step is ever seen — with one step
// on screen at a time, cutting it would mean her work vanished unmarked.
// Comfortably shorter than the shortest stage, so two beats never overlap.
export const CELEBRATION_MS = 900;

export interface WaitStage {
  /** What is happening, in her words. Short enough to read at a glance. */
  readonly label: string;
  /** One line on why that is safe. */
  readonly detail: string;
  /** Where this stage begins, as a fraction of MEASURED_PROOF_MS. */
  readonly startFraction: number;
}

export interface WaitStageView {
  readonly label: string;
  readonly detail: string;
  readonly status: WaitStageStatus;
}

/** The single step on screen, and where it sits in the sequence. */
export interface CurrentWaitStage extends WaitStageView {
  readonly index: number;
}

export interface WaitProgress {
  /** The one step she can see. Everything else is off screen. */
  readonly current: CurrentWaitStage;
  /** Every stage, so a caller can still count them. Statuses match what is
   *  displayed: nothing is ever marked done before it is. */
  readonly stages: readonly WaitStageView[];
  readonly totalStages: number;
  /** The step actually running now. During the held beat this is one ahead
   *  of `current.index`, which is still showing the step that just finished. */
  readonly activeIndex: number;
  /** True while the finished step is holding its check. */
  readonly celebrating: boolean;
  /** The displayed stage's label, repeated so the screen has one clear voice. */
  readonly headline: string;
  readonly detail: string;
  /** "21 s" — the number the ring carries, on its own so it can be the
   *  dominant element without the sentence around it competing. */
  readonly elapsedValue: string;
  /** "Llevamos 21 s" — the whole readout, for anyone who cannot see the ring. */
  readonly elapsedLabel: string;
  /** 0-100, capped below 100 for as long as the proof is still running. */
  readonly percent: number;
  /** The proof is taking longer than the measured run. Nothing is wrong. */
  readonly overtime: boolean;
}

// The displayed step is done only while its successor is already running —
// which is exactly when it is done. Everything after it is pending, and a
// step is never coloured in before its turn.
function statusAt(index: number, shownIndex: number, celebrating: boolean): WaitStageStatus {
  if (index < shownIndex) return 'done';
  if (index === shownIndex) return celebrating ? 'done' : 'active';
  return 'pending';
}

export function buildWaitProgress(
  stages: readonly WaitStage[],
  elapsedMs: number,
): WaitProgress {
  if (stages.length === 0) throw new Error('a wait sequence needs at least one stage');

  const elapsed = Math.max(0, elapsedMs);
  const elapsedSeconds = Math.floor(elapsed / 1000);

  let activeIndex = 0;
  for (let i = 0; i < stages.length; i += 1) {
    if (elapsed >= stages[i]!.startFraction * MEASURED_PROOF_MS) activeIndex = i;
  }

  // Past the measured run the last stage simply holds: a proof that takes
  // longer has not failed, and pretending it finished would be a lie.
  const overtime = elapsed > MEASURED_PROOF_MS;
  const percent = Math.min(MAX_PERCENT, Math.round((elapsed / MEASURED_PROOF_MS) * MAX_PERCENT));

  // The step that just finished holds its check for a beat before the next
  // one arrives. Derived from elapsed time alone, so the sequence stays a
  // pure function of the clock and replays identically.
  const startedAt = stages[activeIndex]!.startFraction * MEASURED_PROOF_MS;
  const celebrating = activeIndex > 0 && elapsed - startedAt < CELEBRATION_MS;
  const shownIndex = celebrating ? activeIndex - 1 : activeIndex;

  const shown = stages[shownIndex]!;
  // Elapsed time is a fact; the estimate it used to be measured against
  // ("21 s de unos 24 s") was precision the app cannot promise on a source
  // whose latency it does not control. What is left is what is true.
  const elapsedValue = `${elapsedSeconds} s`;

  return {
    current: {
      index: shownIndex,
      label: shown.label,
      detail: shown.detail,
      status: celebrating ? 'done' : 'active',
    },
    stages: stages.map((stage, index) => ({
      label: stage.label,
      detail: stage.detail,
      status: statusAt(index, shownIndex, celebrating),
    })),
    totalStages: stages.length,
    activeIndex,
    celebrating,
    headline: shown.label,
    detail: shown.detail,
    elapsedValue,
    elapsedLabel: `Llevamos ${elapsedValue}`,
    percent,
    overtime,
  };
}

// The one promise the verification screen exists to make visible. Short
// enough to sit under the work rather than beside it; the rest of the
// explanation is a tap away in the help centre.
export const WAIT_PROMISE = 'Todo ocurre en tu teléfono. Hasta ahora no hemos enviado datos.';

// Past the measured run the screen stops narrating the work and starts
// telling her she has nothing to do. Same region, patched in place, so no
// transition is interrupted at the moment the wait gets long.
export const OVERTIME_HEADING = 'Estamos terminando';

export const OVERTIME_LEDE = 'La revisión sigue en tu teléfono. No necesitas hacer nada.';

export const OVERTIME_NOTE = 'Puedes esperar aquí mientras termina.';
