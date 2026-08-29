// ui/statusState.ts
// StatusState: one component, four tones, for every screen whose whole
// content is "here is what happened". It replaces the status card that used
// to sit on every screen regardless of state — the tone is carried by a mark
// and a tint on the mark alone, not by wrapping the sentence in a box.

export type StatusTone =
  | 'processing' // work in flight
  | 'success' // the answer arrived and it is yes
  | 'warning' // the answer arrived and it is no: nothing is broken
  | 'error'; // nobody could answer

export interface StatusStateOptions {
  readonly tone: StatusTone;
  /** The one line under the headline. Never a second paragraph of the same. */
  readonly body: string;
  /** Rendered after the body, where the value on screen is a demo value. */
  readonly badge?: string;
}

// The headline is the screen's own h1, rendered by ScreenHeader; this is
// what follows it. Keeping them apart is what lets the same tone read as a
// title on one screen and as a supporting line on another.
export function renderStatusState(options: StatusStateOptions): string {
  return `
    <div class="status-state" data-tone="${options.tone}">
      <p class="status-body">${options.body}</p>
      ${options.badge ?? ''}
    </div>
  `;
}
