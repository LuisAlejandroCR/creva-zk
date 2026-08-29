// theme-mechanism.spec.ts
// The ink palette is reachable two ways — creva_finance's `.dark` class for
// when this is embedded, and prefers-color-scheme for when it runs alone.
// Both must set exactly the same tokens, or the two ways drift apart.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');
// Comments carry colons of their own ("/* Default: Light ... */"), which a
// declaration parser this simple would read as a property and let swallow the
// line after it. None of them contain braces, so dropping them is safe.
const source = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `--token: value;` / `property: value;` pair inside one rule body. */
function declarationsIn(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, prop, value] of body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+);/g)) {
    out.set(prop!.trim(), value!.trim().replace(/\s+/g, ' '));
  }
  return out;
}

function ruleBody(selectorPattern: RegExp): string {
  const match = source.match(selectorPattern);
  expect(match, `no rule matched ${selectorPattern}`).not.toBeNull();
  return match![1]!;
}

// The media-query arm, and the class arm creva_finance itself uses.
const mediaInk = ruleBody(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\.light\) \{([\s\S]*?)\n {2}\}/);
const classInk = ruleBody(/\n\.dark \{([\s\S]*?)\n\}/);

describe('the two ink arms', () => {
  it('set an identical set of tokens', () => {
    expect([...declarationsIn(classInk).keys()].sort()).toEqual([...declarationsIn(mediaInk).keys()].sort());
  });

  it('set identical values for every one of them', () => {
    expect(Object.fromEntries(declarationsIn(classInk))).toEqual(Object.fromEntries(declarationsIn(mediaInk)));
  });

  it('both carry the ink background, so neither is a stub', () => {
    expect(declarationsIn(mediaInk).get('--cr-bg')).toBe('#17130F');
    expect(declarationsIn(classInk).get('--cr-bg')).toBe('#17130F');
  });
});

describe('the light default', () => {
  it('is what :root carries, so an embedding host that sets nothing gets light', () => {
    const base = declarationsIn(ruleBody(/^:root \{([\s\S]*?)\n\}/m));
    expect(base.get('--cr-bg')).toBe('#F6F1E7');
    expect(base.get('color-scheme')).toBe('light');
  });

  it('can be held against a dark OS with .light, for a host that stays light', () => {
    // Without this the media query would force ink on a light host.
    expect(source).toContain(':root:not(.light)');
  });
});
