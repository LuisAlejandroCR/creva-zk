// style-controls.spec.ts
// Regression guard for src/style.css: the 44px control floor and the
// horizontal-overflow guard must stay in the source, not just in memory.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS_PATH = fileURLToPath(new URL('../src/style.css', import.meta.url));
const source = readFileSync(CSS_PATH, 'utf8');

describe('style.css control sizing and overflow', () => {
  it('gives .btn and select controls a 44px floor', () => {
    expect(source).toMatch(/\.btn\s*{[^}]*min-height:\s*44px/);
    expect(source).toMatch(/select\s*{[^}]*min-height:\s*44px/);
  });

  it('guards against horizontal overflow on the root elements', () => {
    expect(source).toMatch(/html,\s*body\s*{[^}]*overflow-x:\s*hidden/);
  });
});
