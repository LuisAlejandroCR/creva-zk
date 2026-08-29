// ui/marks.ts
// The one visual cue an archetype gets. Drawn as inline SVG rather than set
// as emoji so they take Creva's crimson from the stylesheet, animate on
// entrance, and stay crisp at the size a headline sits next to.
//
// Every mark is aria-hidden: the headline beside it already says what state
// this is, and a second announcement would only repeat it.

function svg(body: string, name: string): string {
  return `<span class="state-mark" data-mark="${name}"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg></span>`;
}

// Before anything runs: a shield with a check already inside it. Says "this
// is the part that protects you" — an exclamation here would read as an
// alert on the one screen where nothing has gone wrong yet.
export const MARK_INTRO = svg(
  `<path class="mark-body" d="M24 5 9 10.6v12.2c0 9.4 6.2 17.4 15 19.9 8.8-2.5 15-10.5 15-19.9V10.6L24 5Z" />
   <path class="mark-line" d="m17.5 23.5 4.5 4.5 8.5-9.5" />`,
  'intro',
);

// The answer arrived and it is yes: a check that lands inside a ring already
// on screen. The ring is what expands once; the check does not bounce.
export const MARK_CONFIRM = svg(
  `<circle class="mark-body" cx="24" cy="24" r="19" />
   <path class="mark-line" d="m15.5 24.5 6 6 11-13" />`,
  'confirm',
);

// Nothing was decided and nothing is broken: an open ring, with the gap
// where the answer would have been.
export const MARK_RECOVER = svg(
  `<path class="mark-body" d="M43 24a19 19 0 1 1-8-15.5" />
   <path class="mark-line" d="M24 15v10" />
   <circle class="mark-dot" cx="24" cy="31" r="1.9" />`,
  'recover',
);
