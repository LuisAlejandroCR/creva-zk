// sw-shell-cache.spec.ts
// Regression guard for public/sw.js: only the declared shell paths may be
// cached, and every fetch-failure branch must return a Response, never
// undefined. Static source checks, since a real ServiceWorker needs a
// browser context vitest doesn't provide.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SW_PATH = fileURLToPath(new URL('../public/sw.js', import.meta.url));
const source = readFileSync(SW_PATH, 'utf8');

describe('service worker shell caching', () => {
  it('declares exactly the intended shell assets', () => {
    const match = source.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();

    const entries = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(entries).toEqual([
      '/',
      '/index.html',
      '/manifest.webmanifest',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
    ]);
  });

  it('gates the cache-first path on SHELL_ASSETS membership', () => {
    expect(source).toContain('SHELL_ASSETS.includes(url.pathname)');
  });

  it('never falls back to an unchecked cached value', () => {
    // The bug this guards: `.catch(() => cached)` returns undefined when
    // `cached` was never set, and respondWith throws on that.
    expect(source).not.toMatch(/\.catch\(\(\)\s*=>\s*cached\)/);
  });

  it('every failure path returns a Response, not undefined', () => {
    const catchBlocks = [...source.matchAll(/catch\s*\{([\s\S]*?)\n\s*\}/g)];
    expect(catchBlocks.length).toBeGreaterThan(0);
    for (const [, body] of catchBlocks) {
      expect(body).toMatch(/Response\.error\(\)/);
    }
  });
});
