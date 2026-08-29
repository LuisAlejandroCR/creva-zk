// waitView.ts
// Patches the wait region in place instead of re-rendering it. Replacing the
// markup five times a second would restart every CSS transition mid-flight,
// which is exactly the motion this screen depends on — so the meter and the
// readout are updated field by field, and the one step on screen is swapped
// only when it actually changes.

import { renderWaitStage } from './render';
import type { WaitProgress } from './domain/waitStages';

// A swapped-out step is removed when its leave animation ends. The timeout
// is the fallback for a browser that never fires the event — and for reduced
// motion, where the animation is over before it begins.
const LEAVE_TIMEOUT_MS = 600;

function swapStage(slot: HTMLElement, markup: string): void {
  const outgoing = slot.querySelector<HTMLElement>('[data-role="wait-stage"]:not([data-leaving])');

  // The incoming step goes into the flow and the outgoing one is lifted out
  // of it, so the slot takes the new step's height at once and the old one
  // fades away over the top instead of shoving the layout around.
  slot.insertAdjacentHTML('beforeend', markup);

  if (!outgoing) return;
  outgoing.dataset.leaving = 'true';

  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    outgoing.remove();
  };
  outgoing.addEventListener('animationend', remove, { once: true });
  window.setTimeout(remove, LEAVE_TIMEOUT_MS);
}

export function applyWaitProgress(root: ParentNode, wait: WaitProgress): void {
  const region = root.querySelector<HTMLElement>('[data-role="wait"]');
  if (!region) return;

  region.dataset.overtime = String(wait.overtime);

  const meter = region.querySelector<HTMLElement>('[data-role="wait-meter"]');
  meter?.setAttribute('aria-valuenow', String(wait.percent));

  const fill = region.querySelector<HTMLElement>('[data-role="wait-meter-fill"]');
  if (fill) fill.style.width = `${wait.percent}%`;

  const elapsed = region.querySelector<HTMLElement>('[data-role="wait-elapsed"]');
  if (elapsed) elapsed.textContent = wait.elapsedLabel;

  const slot = region.querySelector<HTMLElement>('[data-role="wait-stage-slot"]');
  if (!slot) return;

  const shown = slot.querySelector<HTMLElement>('[data-role="wait-stage"]:not([data-leaving])');
  const isSameStage = shown?.dataset.stageIndex === String(wait.current.index);

  if (isSameStage && shown) {
    // Same step, new status: the check arrives on the element already there,
    // so it transitions rather than jumping in on a fresh node.
    shown.dataset.status = wait.current.status;
    return;
  }

  swapStage(slot, renderWaitStage(wait.current));
}
