// zkArtifacts.spec.ts
// Covers web/scripts/copyZkArtifacts.mjs: the copy plan built from a fake
// contract/src/managed/ tree, the flat keys/ + zkir/ layout the browser
// provider fetches, and the loud failure when nothing was compiled.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM build script, no type declarations by design.
import { copyPlan, describeFailure, planCopy } from '../scripts/copyZkArtifacts.mjs';

let root: string;

function writeCircuit(circuit: string, ids: readonly string[]): void {
  mkdirSync(join(root, 'managed', circuit, 'keys'), { recursive: true });
  mkdirSync(join(root, 'managed', circuit, 'zkir'), { recursive: true });
  for (const id of ids) {
    writeFileSync(join(root, 'managed', circuit, 'keys', `${id}.prover`), 'p'.repeat(64));
    writeFileSync(join(root, 'managed', circuit, 'keys', `${id}.verifier`), 'v');
    writeFileSync(join(root, 'managed', circuit, 'zkir', `${id}.bzkir`), 'z');
  }
  // Compiler output the browser never reads, and must not be served.
  mkdirSync(join(root, 'managed', circuit, 'contract'), { recursive: true });
  writeFileSync(join(root, 'managed', circuit, 'contract', 'index.cjs'), 'x');
  writeFileSync(join(root, 'managed', circuit, 'zkir', `${ids[0]}.zkir`), 'source');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'creva-zk-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('planCopy', () => {
  it('reports missing when the compiler has never run', () => {
    const plan = planCopy(join(root, 'managed'));
    expect(plan.status).toBe('missing');
  });

  it('reports empty when the directory exists but holds no artifacts', () => {
    mkdirSync(join(root, 'managed', 'backing', 'contract'), { recursive: true });
    expect(planCopy(join(root, 'managed')).status).toBe('empty');
  });

  it('flattens every circuit into one keys/ and one zkir/', () => {
    writeCircuit('backing', ['proveBacking']);
    writeCircuit('identity-check', ['proveIdentity']);

    const plan = planCopy(join(root, 'managed'));
    expect(plan.status).toBe('ok');
    expect(plan.entries.map((e: { target: string }) => e.target)).toEqual([
      'keys/proveBacking.prover',
      'keys/proveBacking.verifier',
      'keys/proveIdentity.prover',
      'keys/proveIdentity.verifier',
      'zkir/proveBacking.bzkir',
      'zkir/proveIdentity.bzkir',
    ]);
  });

  it('serves nothing but the three artifact extensions', () => {
    writeCircuit('backing', ['proveBacking']);
    const targets = planCopy(join(root, 'managed')).entries.map((e: { target: string }) => e.target);
    expect(targets.some((t: string) => t.endsWith('.zkir'))).toBe(false);
    expect(targets.some((t: string) => t.includes('contract'))).toBe(false);
  });

  it('reports a collision instead of silently overwriting a key', () => {
    writeCircuit('backing', ['shared']);
    writeCircuit('backing-tier', ['shared']);

    const plan = planCopy(join(root, 'managed'));
    expect(plan.status).toBe('collision');
    expect(describeFailure(plan)).toContain('shared');
  });
});

describe('copyPlan', () => {
  it('writes the layout FetchZkConfigProvider fetches', () => {
    writeCircuit('backing', ['proveBacking']);
    const target = join(root, 'public', 'zk');

    const result = copyPlan(planCopy(join(root, 'managed')), target);
    expect(result.status).toBe('ok');
    expect(result.copied).toBe(3);
    expect(result.bytes).toBeGreaterThan(0);
    expect(readdirSync(join(target, 'keys')).sort()).toEqual([
      'proveBacking.prover',
      'proveBacking.verifier',
    ]);
    expect(readdirSync(join(target, 'zkir'))).toEqual(['proveBacking.bzkir']);
  });

  it('drops artifacts from a previous compile rather than leaving them stale', () => {
    writeCircuit('backing', ['proveBacking']);
    const target = join(root, 'public', 'zk');
    mkdirSync(join(target, 'keys'), { recursive: true });
    writeFileSync(join(target, 'keys', 'stale.prover'), 'old');

    copyPlan(planCopy(join(root, 'managed')), target);
    expect(readdirSync(join(target, 'keys'))).not.toContain('stale.prover');
  });

  it('copies nothing when the plan is not ok', () => {
    const result = copyPlan(planCopy(join(root, 'managed')), join(root, 'public', 'zk'));
    expect(result.status).toBe('missing');
    expect(result.copied).toBe(0);
  });
});

describe('describeFailure', () => {
  it('names the command that produces the artifacts', () => {
    const message = describeFailure(planCopy(join(root, 'managed')));
    expect(message).toContain('npm run compact:build');
    expect(message).toContain('cannot prove');
  });
});
