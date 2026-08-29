// zkBuildWiring.spec.ts
// Holds the wiring in place: the web build copies the ZK artifacts before it
// bundles and fails when they are absent, dev tolerates their absence, and
// the generated directory stays out of git.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { scripts: Record<string, string> };

const gitignore = readFileSync(
  fileURLToPath(new URL('../../.gitignore', import.meta.url)),
  'utf8',
);

describe('build wiring', () => {
  it('copies the artifacts before vite bundles, with no manual step', () => {
    const build = packageJson.scripts.build;
    expect(build).toContain('copy-zk-artifacts.mjs');
    expect(build.indexOf('copy-zk-artifacts.mjs')).toBeLessThan(build.indexOf('vite build'));
  });

  it('lets the build fail when the artifacts are missing', () => {
    expect(packageJson.scripts.build).not.toContain('--allow-missing');
  });

  it('lets dev start without them, since the default source is the stub', () => {
    expect(packageJson.scripts.dev).toContain('--allow-missing');
  });
});

describe('generated output stays out of git', () => {
  it('ignores web/public/zk/', () => {
    expect(gitignore).toMatch(/^web\/public\/zk\/$/m);
  });
});
