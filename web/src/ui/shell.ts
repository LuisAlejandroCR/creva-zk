// ui/shell.ts
// OnboardingShell, StepIndicator and ScreenHeader: the frame every
// onboarding screen is built in. The shell owns the navigation strip and the
// one dominant content area; what varies between steps is the archetype it
// is given, not the markup each screen writes for itself.
//
// String-in/string-out, like the rest of the view layer, so a screen's shape
// can be asserted under plain vitest.

import type { StepProgress } from '../domain/journeyProgress';
import { renderHelpButton, renderSystemStatus } from './notices';

/**
 * The six shapes an onboarding screen can take. A screen picks one; the
 * spacing, the focal element and the weight of everything around it follow
 * from that choice rather than from per-screen CSS.
 */
export type ScreenArchetype =
  | 'intro' // asking to begin: headline, one explanation, one action
  | 'verifying' // work in flight: the verification itself is the hero
  | 'confirm' // an answer arrived and it is yes
  | 'recover' // nothing to fix but the next attempt
  | 'compare' // two things held side by side
  | 'celebrate'; // the one earned milestone

export interface ShellOptions {
  readonly archetype: ScreenArchetype;
  /** Carried through for the semantic families keyed off the proof phase. */
  readonly phase?: string;
  /** Absent on the help centre, which is not a step of the journey. */
  readonly step?: StepProgress;
  /** The article this screen's ? opens. */
  readonly help: string;
  /** In reading order. Falsy entries are dropped, so a screen can omit a
   *  block by returning an empty string rather than by branching markup. */
  readonly blocks: readonly (string | undefined)[];
}

// One navigation strip for the whole flow: who this is on the left, and on
// the right the two affordances that persist across every screen — the ? and
// the install state. Both are icons that name themselves, so neither spends
// a line of the screen saying what it is.
export function renderTopbar(help?: string): string {
  return `
    <div class="topbar">
      <span class="wordmark">
        <img class="mark" src="/icons/icon-192.png" alt="" width="24" height="24" />
        <span>Creva ZK</span>
      </span>
      <span class="topbar-controls">
        ${help ? renderHelpButton(help) : ''}
        ${renderSystemStatus()}
      </span>
    </div>
  `;
}

// "1 de 4" and a track of one segment per step, at the foot of the screen:
// where she is is worth knowing and never worth reading first. The counter
// and the track say the same thing two ways — one for reading, one for
// glancing — and neither is repeated anywhere else.
export function renderStepIndicator(step: StepProgress): string {
  const segments = step.marks
    .map((mark) => `<span class="stepper-seg" data-state="${mark}"></span>`)
    .join('');

  return `
    <div class="stepper" role="group" aria-label="${step.label}">
      <span class="stepper-count">${step.counter}</span>
      <span class="stepper-track" aria-hidden="true">${segments}</span>
    </div>
  `;
}

export interface ScreenHeaderOptions {
  readonly title: string;
  /** One or two short sentences. Anything longer belongs in the help centre. */
  readonly lede?: string;
  /** A glyph beside the headline, where the state has one worth showing. */
  readonly mark?: string;
}

// The screen title is the primary hierarchy: it is what tells her what is
// happening, so it is the largest thing on the page and it changes with the
// state rather than staying put while a card underneath narrates. The mark
// sits on its line rather than above it, so the two read as one statement.
export function renderScreenHeader(options: ScreenHeaderOptions): string {
  return `
    <header class="screen-header">
      <div class="screen-title-row">
        ${options.mark ?? ''}
        <h1 data-role="screen-title">${options.title}</h1>
      </div>
      ${options.lede ? `<p class="lede" data-role="screen-lede">${options.lede}</p>` : ''}
    </header>
  `;
}

export function renderOnboardingShell(options: ShellOptions): string {
  const phase = options.phase === undefined ? '' : ` data-phase="${options.phase}"`;
  const blocks = options.blocks.filter(Boolean).join('');

  return `
    ${renderTopbar(options.help)}
    <div class="screen-body" data-archetype="${options.archetype}"${phase}>${blocks}</div>
    ${options.step ? renderStepIndicator(options.step) : ''}
  `;
}
