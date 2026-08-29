// ui/verification.ts
// VerificationState: the hero of the active-verification screen. The wait is
// the only moment the product's promise is visible instead of asserted, so
// the work itself is the focal point — a ring that advances at the pace of
// the measured run with the elapsed seconds inside it, and under it the one
// named step of the work happening right now.
//
// The data-role hooks are what waitView.ts patches in place while a proof
// runs, so no transition is ever restarted mid-flight.

import { OVERTIME_NOTE, type CurrentWaitStage, type WaitProgress } from '../domain/waitStages';

// Geometry of the ring, in the SVG's own units. The circumference is what
// the dash offset is computed from, so the arc is a real fraction of the
// circle rather than a hand-tuned number.
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Dash offset for a given percentage: full circumference at 0, none at 100. */
export function ringOffset(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent));
  return (RING_CIRCUMFERENCE * (1 - clamped / 100)).toFixed(2);
}

export const RING_DASH = RING_CIRCUMFERENCE.toFixed(2);

// One step, the one happening now. Four lines stacked read as a to-do list
// she still has to get through; a single line reads as work being done, and
// what is still ahead is the ring's job. When a step finishes it takes its
// check and holds it here for a beat — with one step on screen that beat is
// the only moment a completed step is ever seen.
export function renderVerificationStep(stage: CurrentWaitStage): string {
  return `<div class="verify-step" data-role="wait-stage" data-stage-index="${stage.index}" data-status="${stage.status}">
        <span class="verify-step-mark" aria-hidden="true"></span>
        <span class="verify-step-copy">
          <span class="verify-step-label">${stage.label}</span>
          <span class="verify-step-detail">${stage.detail}</span>
        </span>
      </div>`;
}

export function renderVerificationState(wait: WaitProgress): string {
  return `
    <div class="verify" data-role="wait" data-overtime="${wait.overtime}">
      <div
        class="verify-ring"
        role="progressbar"
        aria-label="Avance de la revisión"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${wait.percent}"
        aria-valuetext="${wait.elapsedLabel}"
        data-role="wait-ring"
      >
        <svg class="verify-ring-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle class="verify-ring-track" cx="60" cy="60" r="${RING_RADIUS}" />
          <circle
            class="verify-ring-fill"
            cx="60"
            cy="60"
            r="${RING_RADIUS}"
            stroke-dasharray="${RING_DASH}"
            stroke-dashoffset="${ringOffset(wait.percent)}"
            data-role="wait-ring-fill"
          />
          <circle class="verify-ring-sweep" cx="60" cy="60" r="${RING_RADIUS}" />
        </svg>
        <span class="verify-elapsed">
          <span class="verify-elapsed-lead">Llevamos</span>
          <span class="verify-elapsed-value" data-role="wait-elapsed">${wait.elapsedValue}</span>
        </span>
      </div>
      <div class="verify-step-slot" data-role="wait-stage-slot" aria-live="polite">${renderVerificationStep(wait.current)}</div>
      <p class="verify-overtime" data-role="wait-overtime">${OVERTIME_NOTE}</p>
    </div>
  `;
}
