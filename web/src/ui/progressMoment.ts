// ui/progressMoment.ts
// ProgressMoment: the popover that hangs off the navigation strip while the
// system is working, says one thing, and goes away on its own. Same gesture
// as icon-button-tip in notices.ts.
//
// The visual leads and the copy captions it. It takes no interaction at all —
// no close button, nothing to tap, nothing inside it she needs in order to
// continue — and the next action stays reachable on the screen behind it the
// whole time it is up.

import type { ProgressMoment } from '../content/waitingMoments';
import { renderMomentVisual } from './momentVisual';

export type ChecklistState = 'done' | 'active' | 'pending';

export interface MomentChecklistItem {
  readonly label: string;
  readonly state: ChecklistState;
}

// Orientation, not documentation. Past this many still-pending items the rest
// are counted rather than listed, so the popover cannot grow into a dashboard.
export const MAX_PENDING_SHOWN = 2;

const STATE_MARK: Readonly<Record<ChecklistState, string>> = {
  done: '✓',
  active: '●',
  pending: '○',
};

/**
 * The progress framing, drawn from the journey's own state rather than from
 * an invented list of paperwork. What she has finished is shown first and
 * counts for as much as what is left: the point is that she is nearly there,
 * not that something is missing.
 */
function renderChecklist(items: readonly MomentChecklistItem[]): string {
  const pending = items.filter((item) => item.state === 'pending');
  const hidden = Math.max(0, pending.length - MAX_PENDING_SHOWN);
  const cutoff = pending.slice(0, MAX_PENDING_SHOWN);
  const shown = items.filter((item) => item.state !== 'pending' || cutoff.includes(item));

  const rows = shown
    .map(
      (item) => `
        <li class="moment-check" data-state="${item.state}">
          <span class="moment-check-mark" aria-hidden="true">${STATE_MARK[item.state]}</span>
          <span class="moment-check-label">${item.label}</span>
        </li>`,
    )
    .join('');

  const more =
    hidden > 0
      ? `<li class="moment-check moment-check--more">+ ${hidden} elemento${hidden === 1 ? '' : 's'} más</li>`
      : '';

  return `<ul class="moment-checklist">${rows}${more}</ul>`;
}

/**
 * role="status" with aria-live="polite": announced once, at the next quiet
 * moment, never interrupting. It announces because it reports what the system
 * is doing on her behalf; nothing she needs in order to finish the journey
 * exists only here.
 */
export function renderProgressMoment(
  moment: ProgressMoment,
  checklist: readonly MomentChecklistItem[] = [],
): string {
  const source = moment.source ? `<span class="moment-source">${moment.source}</span>` : '';
  const list = moment.showsChecklist && checklist.length > 0 ? renderChecklist(checklist) : '';

  return `
    <div class="progress-moment" role="status" aria-live="polite" data-variant="${moment.variant}" data-role="progress-moment">
      ${renderMomentVisual(moment.visual)}
      <div class="moment-copy">
        <span class="moment-eyebrow">${moment.eyebrow}</span>
        <span class="moment-title">${moment.title}</span>
        <span class="moment-body">${moment.body}</span>
        ${source}
        ${list}
      </div>
    </div>
  `;
}

/** Where the popover is mounted: one region for the whole flow, outside every
 *  screen, so a re-render never tears one off mid-life. */
export const PROGRESS_MOMENT_HOST_ID = 'progress-moment-host';

export function renderProgressMomentHost(): string {
  return `<div class="progress-moment-host" id="${PROGRESS_MOMENT_HOST_ID}"></div>`;
}
