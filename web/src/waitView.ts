// waitView.ts
// Patches the verification screen in place instead of re-rendering it.
// Replacing the markup five times a second would restart every CSS
// transition mid-flight, which is exactly the motion this screen depends on
// — so the ring, the readout and, past the measured run, the headline itself
// are updated field by field, and the one step on screen is swapped only
// when it actually changes.

import type { WaitProgress } from './domain/waitStages';
import { renderVerificationStep, ringOffset } from './ui';

export interface WaitPatch {
  readonly wait: WaitProgress;
  /** The screen's headline, which changes once the run goes long. */
  readonly title: string;
  readonly lede: string;
}

// A swapped-out step is removed when its leave animation ends. The timeout
// is the fallback for a browser that never fires the event — and for reduced
// motion, where the animation is over before it begins.
const LEAVE_TIMEOUT_MS = 600;

function setText(root: ParentNode, role: string, text: string): void {
  const el = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
  if (el) el.textContent = text;
}

function swapStep(slot: HTMLElement, markup: string): void {
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

export function applyWaitProgress(root: ParentNode, patch: WaitPatch): void {
  const region = root.querySelector<HTMLElement>('[data-role="wait"]');
  if (!region) return;

  const { wait } = patch;
  region.dataset.overtime = String(wait.overtime);

  // The headline and its line live outside the wait region — patching them
  // here rather than re-rendering is what lets "Estamos terminando" arrive
  // without interrupting the ring.
  setText(root, 'screen-title', patch.title);
  setText(root, 'screen-lede', patch.lede);

  const ring = region.querySelector<HTMLElement>('[data-role="wait-ring"]');
  if (ring) {
    ring.setAttribute('aria-valuenow', String(wait.percent));
    ring.setAttribute('aria-valuetext', wait.elapsedLabel);
  }

  const fill = region.querySelector<SVGElement>('[data-role="wait-ring-fill"]');
  fill?.setAttribute('stroke-dashoffset', ringOffset(wait.percent));

  setText(region, 'wait-elapsed', wait.elapsedValue);

  const slot = region.querySelector<HTMLElement>('[data-role="wait-stage-slot"]');
  if (!slot) return;

  const shown = slot.querySelector<HTMLElement>('[data-role="wait-stage"]:not([data-leaving])');
  const isSameStep = shown?.dataset.stageIndex === String(wait.current.index);

  if (isSameStep && shown) {
    // Same step, new status: the check arrives on the element already there,
    // so it transitions rather than jumping in on a fresh node.
    shown.dataset.status = wait.current.status;
    return;
  }

  swapStep(slot, renderVerificationStep(wait.current));
}
