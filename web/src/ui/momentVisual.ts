// ui/momentVisual.ts
// The four icons a micro-moment can carry, drawn in Creva's own idiom: a
// 24-unit line glyph, 1.75 stroke, round caps and joins, crimson on a soft
// circular chip — the same language as the settings rows.
//
// They are inline SVG rather than image files so they take the theme's own
// tokens and need no network. Nothing here carries meaning the title beside
// it does not also carry in words, which is why the chip is aria-hidden.

import type { MomentVisual } from '../content/waitingMoments';

// One eased gesture each, played once. A perpetual animation would compete
// with the verification ring already turning on the screen behind this, and a
// moment that never settles reads as a spinner rather than as a picture.
const ART: Readonly<Record<MomentVisual, string>> = {
  // Access: a door standing open with the way in drawn through it.
  door: `
    <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    <path class="moment-art-move" d="M3 12h11" />
    <path class="moment-art-move" d="M10 8l4 4-4 4" />
  `,
  // Momentum: the north star of this whole component. It is a bicycle, it is
  // moving, and it needs no caption to say so.
  wheel: `
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
    <circle cx="15" cy="5" r="1" />
    <path class="moment-art-move" d="M1 9h2.5" />
    <path class="moment-art-move" d="M0.5 12.5h1.5" />
  `,
  // Assembling: two courses laid, the last one still dashed.
  assembling: `
    <rect x="4" y="16" width="16" height="4" rx="1.5" />
    <rect x="4" y="10" width="16" height="4" rx="1.5" />
    <rect class="moment-art-move" x="4" y="4" width="16" height="4" rx="1.5" stroke-dasharray="3 3" />
  `,
  // Arrival.
  burst: `
    <circle cx="12" cy="13.5" r="7" />
    <path class="moment-art-move" d="M9 13.5l2.2 2.2 4.3-4.6" />
    <path class="moment-art-rays" d="M12 2v2" />
    <path class="moment-art-rays" d="M4.4 5.4l1.4 1.4" />
    <path class="moment-art-rays" d="M19.6 5.4l-1.4 1.4" />
  `,
};

/**
 * The chip at the head of the popover. aria-hidden because it repeats what
 * the title says, and a screen reader gains nothing from a second telling.
 */
export function renderMomentVisual(visual: MomentVisual): string {
  return `
    <span class="moment-art" data-visual="${visual}" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation" focusable="false"
           fill="none" stroke="currentColor" stroke-width="1.75"
           stroke-linecap="round" stroke-linejoin="round">
        ${ART[visual]}
      </svg>
    </span>
  `;
}
