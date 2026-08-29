// momentView.ts
// Shows one progress moment at a time and takes it away again. Anchors the
// popover under the navigation strip by measuring it, so the offset is never
// a constant that a change to the strip would silently break.
//
// There is no interaction here at all: no hover pause, no focus trap, no
// close button. It comes out, it is read, it goes. Anything she needs in
// order to continue is on the screen behind it the whole time.

import { renderProgressMoment } from './ui/progressMoment';
import type { ProgressMoment } from './content/financialFacts';

// Long enough to read a title and one sentence without hurrying, short enough
// that it is gone before she reaches for the next action.
export const MOMENT_VISIBLE_MS = 3_000;

// Matches the leave transition in style.css, so the node is removed once it
// has finished fading rather than mid-fade.
const MOMENT_LEAVE_MS = 260;

// Where the popover hangs from. The strip is rebuilt on every render, so it
// is looked up at show time rather than held.
const TOPBAR_SELECTOR = '.topbar';

export interface MomentTimer {
  /** Show this moment, replacing whatever is on screen. */
  show(moment: ProgressMoment): void;
  /** Take the current popover away and stop every pending timer. */
  dispose(): void;
}

export interface MomentTimerOptions {
  /** Injectable so a test does not have to wait three real seconds. */
  readonly visibleMs?: number;
}

export function createMomentTimer(host: HTMLElement, options: MomentTimerOptions = {}): MomentTimer {
  const visibleMs = options.visibleMs ?? MOMENT_VISIBLE_MS;
  let visibleHandle: ReturnType<typeof setTimeout> | undefined;
  let removeHandle: ReturnType<typeof setTimeout> | undefined;

  function clearTimers(): void {
    if (visibleHandle !== undefined) clearTimeout(visibleHandle);
    if (removeHandle !== undefined) clearTimeout(removeHandle);
    visibleHandle = undefined;
    removeHandle = undefined;
  }

  // The strip's own bottom edge, measured. A constant here would be wrong the
  // first time the strip changes height, and wrong silently.
  function anchorToStrip(): void {
    const doc = host.ownerDocument;
    const topbar = doc?.querySelector<HTMLElement>(TOPBAR_SELECTOR);
    if (!topbar || typeof topbar.getBoundingClientRect !== 'function') return;
    const rect = topbar.getBoundingClientRect();
    host.style.top = `${Math.round(rect.bottom)}px`;
    host.style.left = `${Math.round(rect.left)}px`;
    host.style.width = `${Math.round(rect.width)}px`;
  }

  function dismiss(): void {
    const popover = host.querySelector<HTMLElement>('[data-role="progress-moment"]');
    if (!popover) return;
    popover.dataset.leaving = 'true';
    removeHandle = setTimeout(() => popover.remove(), MOMENT_LEAVE_MS);
  }

  return {
    show(moment: ProgressMoment): void {
      clearTimers();
      host.innerHTML = renderProgressMoment(moment);
      anchorToStrip();
      visibleHandle = setTimeout(dismiss, visibleMs);
    },
    dispose(): void {
      clearTimers();
      host.innerHTML = '';
    },
  };
}
