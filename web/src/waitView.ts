// waitView.ts
// Patches the wait region in place instead of re-rendering it. Replacing the
// markup four times a second would restart every CSS transition mid-flight,
// which is exactly the motion this screen depends on — so the meter, the
// readout and each stage's status are updated field by field.

import type { WaitProgress } from './domain/waitStages';

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

  wait.stages.forEach((stage, index) => {
    const row = region.querySelector<HTMLElement>(`[data-stage-index="${index}"]`);
    if (row) row.dataset.status = stage.status;
  });
}
