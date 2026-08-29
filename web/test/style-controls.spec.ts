// style-controls.spec.ts
// Regression guard for src/style.css: the 44px control floor, the
// horizontal-overflow guard, the Creva semantic-family wiring for each
// proof phase, and the axe-core-measured AA contrast fixes below.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS_PATH = fileURLToPath(new URL('../src/style.css', import.meta.url));
const source = readFileSync(CSS_PATH, 'utf8');

describe('style.css control sizing and overflow', () => {
  // .cr-select and .demo-control styled a demo-scenario selector no screen
  // ever rendered; they went out with the redesign rather than being carried
  // forward as dead rules. Every control the app does render is checked here.
  it('gives every interactive control a 44px floor', () => {
    expect(source).toMatch(/\.btn-primary\s*{[^}]*min-height:\s*52px/);
    expect(source).toMatch(/\.btn-secondary\s*{[^}]*min-height:\s*44px/);
    // The ? and the install lock are glyphs, so the target is the whole
    // control rather than the 26px circle drawn inside it.
    expect(source).toMatch(/\.icon-button\s*{[^}]*width:\s*44px/);
    expect(source).toMatch(/\.icon-button\s*{[^}]*height:\s*44px/);
  });

  it('gives every control a visible focus ring, in the brand crimson', () => {
    for (const selector of ['btn-primary', 'btn-secondary', 'icon-button', 'help-back', 'security-notice-more']) {
      expect(source, selector).toMatch(
        new RegExp(`\\.${selector}:focus-visible\\s*{[^}]*outline:\\s*2px solid var\\(--cr-crimson\\)`),
      );
    }
  });

  it('guards against horizontal overflow on the root elements', () => {
    expect(source).toMatch(/html,\s*body\s*{[^}]*overflow-x:\s*hidden/);
  });
});

// The exact token names declared in creva_finance/frontend/app/globals.css —
// the palette's source of truth. Anything declared in style.css outside this
// list (plus --font-playfair/--font-inter, the same var names layout.tsx
// binds Montserrat/Manrope to) would be an invented token.
const KNOWN_CREVA_TOKENS = new Set([
  'cr-crimson', 'cr-crimson-dark', 'cr-rosa', 'cr-inactive', 'cr-gradient',
  'cr-on-brand', 'cr-on-brand-soft', 'cr-card-gradient', 'cr-card-frozen-gradient',
  'cr-card-shadow', 'cr-card-shadow-frozen', 'cr-shadow-brand', 'cr-shadow-brand-sm',
  'cr-ease', 'cr-sidebar-w', 'cr-dur-fast', 'cr-dur', 'cr-dur-slow',
  'cr-success', 'cr-success-bg', 'cr-success-border', 'cr-success-text',
  'cr-danger', 'cr-danger-bg', 'cr-danger-border', 'cr-danger-text',
  'cr-warning', 'cr-warning-bg', 'cr-warning-border', 'cr-warning-text',
  'cr-info', 'cr-info-bg', 'cr-info-border', 'cr-info-text',
  'cr-bg', 'cr-surface-1', 'cr-surface-2', 'cr-text', 'cr-text-secondary',
  'cr-text-muted', 'cr-text-subtle', 'cr-border', 'cr-obsidian',
  'font-playfair', 'font-inter',
]);

describe('style.css Creva token wiring', () => {
  it('never declares a token outside the palette source of truth', () => {
    const declaredTokens = [...source.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]!);
    for (const token of declaredTokens) {
      expect(KNOWN_CREVA_TOKENS.has(token)).toBe(true);
    }
  });
});

// StatusState carries the state in one rule down its edge rather than in a
// card around the sentence, but which semantic family that rule comes from
// is unchanged — and the mapping is the same one the proof phases always
// had: work in flight is warning, an answer that is yes is success, an
// answer that is no is danger, and nobody answering is info.
describe('style.css StatusState tones keep the Creva semantic families', () => {
  it.each([
    ['processing', 'cr-warning'],
    ['success', 'cr-success'],
    ['warning', 'cr-danger'],
    ['error', 'cr-info'],
  ])('keys the %s tone off --%s', (tone, family) => {
    expect(source).toMatch(new RegExp(`\\[data-tone='${tone}'\\]\\s*{[^}]*--${family}`));
  });
});

// Measured with axe-core (color-contrast rule) across every screen, phase,
// width (320/375/390) and theme (light/dark): each of these selectors used
// to sit under AA's 4.5:1 at their rendered size. Pin the fix so a future
// edit can't quietly put the *-text/*-subtle token back.
describe('style.css AA contrast fixes (axe-core measured)', () => {
  it('.stepper-count uses --cr-text-secondary, not the failing --cr-text-subtle', () => {
    expect(source).toMatch(/\.stepper-count\s*{[^}]*color:\s*var\(--cr-text-secondary\)/);
  });

  it('.compare-counterparty uses --cr-text, not the failing --cr-danger-text', () => {
    expect(source).toMatch(/\.compare-counterparty\s*{[^}]*color:\s*var\(--cr-text\)/);
  });

  it('.compare-item--crossed no longer dims text opacity on top of the tint', () => {
    expect(source).not.toMatch(/\.compare-item--crossed\s*{\s*opacity:/);
  });

  it('.disclaimer uses --cr-text, not the failing --cr-info-text', () => {
    expect(source).toMatch(/\.disclaimer\s*{[^}]*color:\s*var\(--cr-text\)/);
  });

  it('.badge-success uses --cr-text: --cr-success-text measures 4.47:1 on the tier reveal', () => {
    expect(source).toMatch(/\.badge-success\s*{[^}]*color:\s*var\(--cr-text\)/);
  });

  it('.badge-synthetic and .status use --cr-text-muted, not the failing --cr-text-secondary', () => {
    expect(source).toMatch(/\.badge-synthetic\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
    expect(source).toMatch(/\.status\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
  });

  // The new surfaces the redesign added, on the page ground rather than on a
  // tint: --cr-text-muted is the token that clears AA on --cr-bg in both
  // themes, and --cr-text-secondary is what the smaller metadata takes.
  it('keeps the lede, the promise and the step copy on tokens that clear AA', () => {
    expect(source).toMatch(/\.intro,\n\.lede\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
    expect(source).toMatch(/\.security-notice\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
    // The step on screen is never de-emphasised; only the one holding its
    // check on its way out takes the muted ink.
    expect(source).toMatch(
      /\.verify-step\[data-status='done'\] \.verify-step-label\s*{[^}]*color:\s*var\(--cr-text-muted\)/,
    );
    expect(source).toMatch(/\.verify-elapsed-lead\s*{[^}]*color:\s*var\(--cr-text-secondary\)/);
  });
});

// Criterion 4: motion marks state changes, and it is spelled with Creva's
// own easing and duration tokens rather than hand-picked numbers.
describe('style.css motion', () => {
  it('times every transition and animation with --cr-ease and a --cr-dur* token', () => {
    const timings = [...source.matchAll(/(?:transition|animation):[^;]+;/g)].map((m) => m[0]);
    expect(timings.length).toBeGreaterThan(0);
    for (const timing of timings) {
      expect(timing).toMatch(/var\(--cr-dur(-fast|-slow)?\)/);
      // The verification ring is the one exception, and a deliberate one: it
      // reports elapsed time, so easing its advance would report the wrong
      // time.
      const isTimeReadout = timing.includes('stroke-dashoffset') && timing.includes('linear');
      if (!isTimeReadout) expect(timing).toContain('var(--cr-ease)');
    }
  });

  it('animates the state changes that carry meaning: the ring, the split, the tier', () => {
    expect(source).toMatch(/\.verify-ring-fill\s*{[^}]*transition:\s*stroke-dashoffset/);
    expect(source).toMatch(/\.verify-step-mark\s*{[^}]*transition:/);
    // One step leaves as the next arrives, in the same slot.
    expect(source).toMatch(/\.verify-step\s*{[^}]*animation:\s*cr-step-enter/);
    expect(source).toMatch(/\.verify-step\[data-leaving\]\s*{[^}]*animation:\s*cr-step-leave/);
    expect(source).toMatch(/\.verify-step-slot\s*{[^}]*position:\s*relative/);
    // The departing step is lifted out of the flow, so the slot never jumps.
    expect(source).toMatch(/\.verify-step\[data-leaving\]\s*{[^}]*position:\s*absolute/);
    expect(source).toMatch(/\.stepper-seg\s*{[^}]*transition:/);
    expect(source).toMatch(/\.compare-col--exposed\s*{[^}]*animation:\s*cr-enter-left/);
    expect(source).toMatch(/\.compare-col--sealed\s*{[^}]*animation:\s*cr-enter-right/);
    expect(source).toMatch(/\.tier-badge\s*{[^}]*animation:\s*cr-land/);
    // Criterion 11's ring, which had a keyframe and no rule using it.
    expect(source).toMatch(/\.tier-reveal::before\s*{[^}]*animation:\s*cr-milestone-ring/);
  });

  it('stands every animation down under prefers-reduced-motion', () => {
    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^}]*{[^}]*animation-duration:\s*1ms\s*!important/,
    );
    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^}]*{[^}]*transition-duration:\s*1ms\s*!important/,
    );
  });
});

// The explanation left the flow: what a screen carries now is a ?, and it
// has to be as easy to hit as the back link it sits beside.
// Criterion 1 of the redesign: hierarchy rather than containers. These are
// the four surfaces that used to stack on a single screen; only the split,
// whose whole point is two things side by side, still draws a box.
describe('style.css uses hierarchy where it used to use containers', () => {
  it('gives the status, the wait and the disclaimer a rule rather than a card', () => {
    expect(source).toMatch(/\.status-state\s*{[^}]*border-left:\s*3px solid/);
    expect(source).toMatch(/\.disclaimer\s*{[^}]*border-left:\s*3px solid/);
    expect(source).not.toMatch(/\.status-panel\s*{/);
    expect(source).not.toMatch(/\.wait\s*{/);
  });

  it('leaves the system status no card at all, since it is about the app', () => {
    expect(source).not.toMatch(/\.status\s*{[^}]*background:/);
    expect(source).not.toMatch(/\.status\s*{[^}]*border:/);
  });
});

describe('style.css help centre', () => {
  it('gives every help row and the way back a 44px target', () => {
    expect(source).toMatch(/\.help-back\s*{[^}]*min-height:\s*44px/);
    expect(source).toMatch(/\.help-card,\s*\n\.help-row\s*{[^}]*min-height:\s*44px/);
  });

  it('declares no disclosure styles, because there is no disclosure left', () => {
    expect(source).not.toMatch(/\.tech(-|\s|{)/);
  });
});
