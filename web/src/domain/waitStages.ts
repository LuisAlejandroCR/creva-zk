// waitStages.ts
// The staged model behind the wait screen: turns elapsed milliseconds into
// an ordered checklist, a meter and a plain-language seconds readout. Pure
// and DOM-free, so the whole sequence is testable without waiting 24s.

export type WaitStageStatus = 'done' | 'active' | 'pending';

// End-to-end latency of one real proof, measured by
// tools/measure-proof-latency.sh. The stage boundaries below are fractions
// of it, so the sequence is paced by the real thing rather than invented.
export const MEASURED_PROOF_MS = 23_700;

const MEASURED_PROOF_SECONDS = Math.round(MEASURED_PROOF_MS / 1000);

// The meter never fills while the answer is still coming: the last sliver is
// the difference between "casi" and a claim we cannot make yet.
const MAX_PERCENT = 96;

export interface WaitStage {
  /** What is happening, in her words. */
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

export interface WaitProgress {
  readonly stages: readonly WaitStageView[];
  readonly activeIndex: number;
  /** The active stage's label, repeated so the screen has one clear voice. */
  readonly headline: string;
  readonly detail: string;
  readonly elapsedLabel: string;
  /** 0-100, capped below 100 for as long as the proof is still running. */
  readonly percent: number;
  /** The proof is taking longer than the measured run. Nothing is wrong. */
  readonly overtime: boolean;
}

function statusAt(index: number, activeIndex: number): WaitStageStatus {
  if (index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return 'pending';
}

function elapsedLabel(elapsedSeconds: number, overtime: boolean): string {
  if (overtime) return `${elapsedSeconds} s · ya casi`;
  return `${elapsedSeconds} s de unos ${MEASURED_PROOF_SECONDS} s`;
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

  const active = stages[activeIndex]!;

  return {
    stages: stages.map((stage, index) => ({
      label: stage.label,
      detail: stage.detail,
      status: statusAt(index, activeIndex),
    })),
    activeIndex,
    headline: active.label,
    detail: active.detail,
    elapsedLabel: elapsedLabel(elapsedSeconds, overtime),
    percent,
    overtime,
  };
}

// The one promise the wait screen exists to make visible. It sits above the
// checklist and never changes, because it never stops being true.
export const WAIT_PROMISE = 'Todo esto pasa en tu teléfono. Hasta ahora no se ha enviado nada a nadie.';

export const OVERTIME_NOTE =
  'Está tardando un poco más de lo normal. Sigue trabajando aquí mismo, no lo cierres.';
