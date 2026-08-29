// copyZkArtifacts.mjs
// Mirrors the compiler's ZK artifacts from contract/src/managed/ into
// web/public/zk/, in the keys/ + zkir/ layout FetchZkConfigProvider fetches.
// Pure planning functions plus one copy step; every outcome is a typed
// result, never a throw, so the CLI wrapper decides what is fatal.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const KEY_DIR = 'keys';
export const ZKIR_DIR = 'zkir';

// Exactly the three extensions NodeZkConfigProvider reads, so nothing else
// the compiler leaves behind (contract/, compiler/, .zkir sources) is served.
export const ARTIFACT_DIRS = [
  { subDir: KEY_DIR, extensions: ['.prover', '.verifier'] },
  { subDir: ZKIR_DIR, extensions: ['.bzkir'] },
];

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Walks contract/src/managed/<circuit>/{keys,zkir}/ and returns the flat copy
// plan. Circuit ids are unique across circuits, so the three per-circuit
// directories collapse into one keys/ and one zkir/ — the layout the browser
// provider expects. A collision would silently drop a key, so it is reported
// rather than resolved.
export function planCopy(managedDir) {
  if (!isDirectory(managedDir)) {
    return { status: 'missing', managedDir, entries: [], collisions: [] };
  }

  const entries = [];
  const collisions = [];
  const seen = new Map();

  for (const circuit of listDir(managedDir).filter((e) => e.isDirectory())) {
    for (const { subDir, extensions } of ARTIFACT_DIRS) {
      const from = join(managedDir, circuit.name, subDir);
      for (const file of listDir(from).filter((e) => e.isFile())) {
        if (!extensions.some((ext) => file.name.endsWith(ext))) continue;

        const target = `${subDir}/${file.name}`;
        const previous = seen.get(target);
        if (previous !== undefined && previous !== circuit.name) {
          collisions.push({ target, circuits: [previous, circuit.name] });
          continue;
        }
        seen.set(target, circuit.name);
        entries.push({ from: join(from, file.name), target });
      }
    }
  }

  entries.sort((a, b) => a.target.localeCompare(b.target));
  if (collisions.length > 0) return { status: 'collision', managedDir, entries, collisions };
  if (entries.length === 0) return { status: 'empty', managedDir, entries, collisions };
  return { status: 'ok', managedDir, entries, collisions };
}

// Replaces publicDir wholesale: a stale prover key from a previous compile is
// worse than none, because it fails inside the proof rather than at build.
export function copyPlan(plan, publicDir) {
  if (plan.status !== 'ok') return { status: plan.status, copied: 0, bytes: 0 };

  try {
    rmSync(publicDir, { recursive: true, force: true });
    let bytes = 0;
    for (const entry of plan.entries) {
      const destination = join(publicDir, ...entry.target.split('/'));
      mkdirSync(join(destination, '..'), { recursive: true });
      cpSync(entry.from, destination);
      bytes += statSync(entry.from).size;
    }
    return { status: 'ok', copied: plan.entries.length, bytes };
  } catch (cause) {
    return { status: 'copy_failed', copied: 0, bytes: 0, reason: String(cause) };
  }
}

export function describeFailure(plan) {
  const head =
    plan.status === 'missing'
      ? `No compiled circuits: ${plan.managedDir} does not exist.`
      : plan.status === 'empty'
        ? `No ZK artifacts under ${plan.managedDir} (looked for keys/*.prover, keys/*.verifier, zkir/*.bzkir).`
        : plan.status === 'collision'
          ? `Two circuits write the same artifact name: ${plan.collisions
              .map((c) => `${c.target} (${c.circuits.join(', ')})`)
              .join('; ')}.`
          : `Could not copy the ZK artifacts.`;

  return `${head}\nThe browser-direct (lace) proof path cannot prove without them.\nRun \`npm run compact:build\` at the repository root, then build again.`;
}
