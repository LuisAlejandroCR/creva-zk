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
  it('gives .btn-primary and .cr-select controls a 44px floor', () => {
    expect(source).toMatch(/\.btn-primary\s*{[^}]*min-height:\s*52px/);
    expect(source).toMatch(/\.cr-select\s*{[^}]*min-height:\s*44px/);
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

  it('keys the generating phase off --cr-warning-*', () => {
    expect(source).toMatch(/\[data-phase='generating'\]\s*{[^}]*--cr-warning/);
  });

  it('keys the failed phase off --cr-danger-*', () => {
    expect(source).toMatch(/\[data-phase='failed'\]\s*{[^}]*--cr-danger/);
  });

  it('keys the ready phase off --cr-success-*', () => {
    expect(source).toMatch(/\[data-phase='ready'\]\s*{[^}]*--cr-success/);
  });

  it('keys the degraded phase off --cr-info-*', () => {
    expect(source).toMatch(/\[data-phase='degraded'\]\s*{[^}]*--cr-info/);
  });
});

// Measured with axe-core (color-contrast rule) across every screen, phase,
// width (320/375/390) and theme (light/dark): each of these selectors used
// to sit under AA's 4.5:1 at their rendered size. Pin the fix so a future
// edit can't quietly put the *-text/*-subtle token back.
describe('style.css AA contrast fixes (axe-core measured)', () => {
  it('.progress uses --cr-text-secondary, not the failing --cr-text-subtle', () => {
    expect(source).toMatch(/\.progress\s*{[^}]*color:\s*var\(--cr-text-secondary\)/);
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

  it('.demo-control > span, .badge-synthetic and .status use --cr-text-muted, not the failing --cr-text-secondary', () => {
    expect(source).toMatch(/\.demo-control > span\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
    expect(source).toMatch(/\.badge-synthetic\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
    expect(source).toMatch(/\.status\s*{[^}]*color:\s*var\(--cr-text-muted\)/);
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
      // The wait meter is the one exception, and a deliberate one: it reports
      // elapsed time, so easing its fill would report the wrong time.
      const isTimeReadout = timing.includes('width') && timing.includes('linear');
      if (!isTimeReadout) expect(timing).toContain('var(--cr-ease)');
    }
  });

  it('animates the state changes that carry meaning: the wait, the split, the tier', () => {
    expect(source).toMatch(/\.wait-meter-fill\s*{[^}]*transition:\s*width/);
    expect(source).toMatch(/\.wait-stage-mark\s*{[^}]*transition:/);
    expect(source).toMatch(/\.compare-col--exposed\s*{[^}]*animation:\s*cr-enter-left/);
    expect(source).toMatch(/\.compare-col--sealed\s*{[^}]*animation:\s*cr-enter-right/);
    expect(source).toMatch(/\.tier-badge\s*{[^}]*animation:\s*cr-land/);
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

// The disclosure is the whole plain-language-first mechanism: a summary that
// is a real 44px target, and a body that is only revealed on request.
describe('style.css technical disclosure', () => {
  it('gives the summary a 44px target', () => {
    expect(source).toMatch(/\.tech-summary\s*{[^}]*min-height:\s*44px/);
  });
});
