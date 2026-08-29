// ui/progressMoment.ts
// ProgressMoment: the popover that comes out of the navigation strip after a
// step is completed, says what she just did, and goes away on its own. Same
// gesture as icon-button-tip in notices.ts — it hangs off the strip rather
// than floating over the flow.
//
// It takes no interaction: no close button, nothing to tap, nothing inside it
// she needs in order to continue. The next action is on the screen the whole
// time it is up, and the strip is the one part of the frame that is never
// what she is reaching for.

import type { ProgressMoment } from '../content/financialFacts';

// One glyph per variant, and never the only thing carrying the meaning — the
// eyebrow or the title beside it says the same in words, which is why the
// glyph is aria-hidden.
const VARIANT_MARK: Readonly<Record<ProgressMoment['variant'], string>> = {
  encouragement: '✓',
  financialFact: '✦',
  milestone: '✦',
  finalCelebration: '✓',
};

/**
 * role="status" with aria-live="polite": announced once, at the next quiet
 * moment, never interrupting. It announces because it marks a state change
 * she caused by finishing a step — a purely decorative flourish would take
 * aria-hidden instead.
 */
export function renderProgressMoment(moment: ProgressMoment): string {
  const eyebrow = moment.eyebrow ? `<span class="moment-eyebrow">${moment.eyebrow}</span>` : '';
  const source = moment.source ? `<span class="moment-source">${moment.source}</span>` : '';

  return `
    <div class="progress-moment" role="status" aria-live="polite" data-variant="${moment.variant}" data-role="progress-moment">
      <span class="moment-mark" aria-hidden="true">${VARIANT_MARK[moment.variant]}</span>
      <span class="moment-copy">
        ${eyebrow}
        <span class="moment-title">${moment.title}</span>
        <span class="moment-body">${moment.body}</span>
        ${source}
      </span>
    </div>
  `;
}

/** Where the popover is mounted: one region for the whole flow, outside every
 *  screen, so a re-render never tears one off mid-life. */
export const PROGRESS_MOMENT_HOST_ID = 'progress-moment-host';

export function renderProgressMomentHost(): string {
  return `<div class="progress-moment-host" id="${PROGRESS_MOMENT_HOST_ID}"></div>`;
}
