// style-controls.spec.ts
// Regression guard for src/style.css: the 44px control floor, the
// horizontal-overflow guard, and the Creva semantic-family wiring for each
// proof phase must stay in the source, not just in memory.

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
