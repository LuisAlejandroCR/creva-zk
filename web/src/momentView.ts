// momentView.ts
// Schedules the micro-moments against the processing period they belong to
// and takes them away again. A moment is armed when a proof starts and
// disarmed when it settles: the wait owns the moment, never the other way
// round, so nothing here can add a millisecond to the journey.
//
// It also anchors the popover under the navigation strip by measuring the
// strip, so the offset is never a constant that a change to the strip would
// silently break. There is no interaction: no hover pause, no close button.

import { renderProgressMoment, type MomentChecklistItem } from './ui/progressMoment';
import {
  cuesFor,
  momentByOrder,
  type MomentCue,
  type ProgressMoment,
  type WaitKind,
} from './content/waitingMoments';

// Long enough to read a caption without hurrying, short enough to be gone
// before she reaches for the next action.
export const MOMENT_VISIBLE_MS = 3_000;

// Matches the leave animation in style.css, so the node is removed once it
// has finished fading rather than mid-fade.
const MOMENT_LEAVE_MS = 260;

// Where the popover hangs from. The strip is rebuilt on every render, so it
// is looked up at show time rather than held.
const TOPBAR_SELECTOR = '.topbar';

/** How the proof ended. Only an answer earns the closing moment. */
export type WaitOutcome = 'ready' | 'unanswered';

export interface MomentScheduler {
  /** Processing began: arm this wait's cues. */
  startWait(wait: WaitKind): void;
  /** Processing ended: drop anything still armed, clear the screen, and play
   *  the closing moment if an answer arrived. */
  endWait(wait: WaitKind, outcome: WaitOutcome): void;
  /** Start over: the arc can be seen again from the beginning. */
  reset(): void;
  dispose(): void;
}

export interface MomentSchedulerOptions {
  /** Injectable so a test does not have to wait three real seconds. */
  readonly visibleMs?: number;
  /** The journey's own state, read at show time. */
  readonly checklist?: () => readonly MomentChecklistItem[];
}

export function createMomentScheduler(
  host: HTMLElement,
  options: MomentSchedulerOptions = {},
): MomentScheduler {
  const visibleMs = options.visibleMs ?? MOMENT_VISIBLE_MS;
  const readChecklist = options.checklist ?? ((): readonly MomentChecklistItem[] => []);

  // Every timer this module owns, so a proof that settles early leaves none
  // of them behind.
  let armed: ReturnType<typeof setTimeout>[] = [];
  let visibleHandle: ReturnType<typeof setTimeout> | undefined;
  let removeHandle: ReturnType<typeof setTimeout> | undefined;
  // A moment marks one passage of the journey and is never replayed: coming
  // back from the help centre, or a re-render, must not show it twice.
  const played = new Set<number>();

  function disarm(): void {
    for (const handle of armed) clearTimeout(handle);
    armed = [];
  }

  function clearLife(): void {
    if (visibleHandle !== undefined) clearTimeout(visibleHandle);
    if (removeHandle !== undefined) clearTimeout(removeHandle);
    visibleHandle = undefined;
    removeHandle = undefined;
  }

  // The strip's own bottom edge, measured. A constant here would be wrong the
  // first time the strip changes height, and wrong silently. False means
  // there is no strip on screen to hang from — the help centre, for one — and
  // an unanchored popover would land wherever the layout happened to leave
  // it, over whatever she went there to read.
  function anchorToStrip(): boolean {
    const doc = host.ownerDocument;
    const topbar = doc?.querySelector<HTMLElement>(TOPBAR_SELECTOR);
    if (!topbar || typeof topbar.getBoundingClientRect !== 'function') return false;
    const rect = topbar.getBoundingClientRect();
    host.style.top = `${Math.round(rect.bottom)}px`;
    host.style.left = `${Math.round(rect.left)}px`;
    host.style.width = `${Math.round(rect.width)}px`;
    return true;
  }

  function dismiss(): void {
    const popover = host.querySelector<HTMLElement>('[data-role="progress-moment"]');
    if (!popover) return;
    popover.dataset.leaving = 'true';
    removeHandle = setTimeout(() => popover.remove(), MOMENT_LEAVE_MS);
  }

  function play(moment: ProgressMoment): void {
    clearLife();
    // Spent either way: the moment belonged to this passage of the wait, and
    // a moment held back to be shown later is exactly the after-the-fact
    // notification this component exists to stop being.
    played.add(moment.order);
    if (!anchorToStrip()) return;
    host.innerHTML = renderProgressMoment(moment, readChecklist());
    visibleHandle = setTimeout(dismiss, visibleMs);
  }

  function playCue(cue: MomentCue): void {
    if (played.has(cue.order)) return;
    const moment = momentByOrder(cue.order);
    if (moment !== undefined) play(moment);
  }

  return {
    startWait(wait: WaitKind): void {
      disarm();
      for (const cue of cuesFor(wait, 'processing')) {
        armed.push(setTimeout(() => playCue(cue), cue.afterMs));
      }
    },

    endWait(wait: WaitKind, outcome: WaitOutcome): void {
      // Anything still waiting its turn has run out of wait to live in. It is
      // dropped rather than shown late: the moment belongs to the processing
      // period, and that period is over.
      disarm();
      clearLife();
      dismiss();

      if (outcome !== 'ready') return;
      for (const cue of cuesFor(wait, 'settled')) {
        armed.push(setTimeout(() => playCue(cue), cue.afterMs));
      }
    },

    reset(): void {
      disarm();
      clearLife();
      played.clear();
      host.innerHTML = '';
    },

    dispose(): void {
      disarm();
      clearLife();
      host.innerHTML = '';
    },
  };
}
