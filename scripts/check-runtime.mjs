// check-runtime.mjs
// Fails the gate when more than one copy of the Midnight WASM runtime is
// installed. Two copies mean two StateValue classes, so every `instanceof`
// inside a circuit call fails — the bug that cost five debugging rounds.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TARGET = 'onchain-runtime-v3';
const ROOT = 'node_modules';
const MAX_DEPTH = 6;

/** Walks node_modules to MAX_DEPTH and collects every directory named TARGET. */
function find(dir, depth, found) {
  if (depth > MAX_DEPTH) return found;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (entry.name === TARGET) {
      found.push(path);
      continue;
    }
    find(path, depth + 1, found);
  }
  return found;
}

const copies = find(ROOT, 1, []);

if (copies.length === 1) {
  console.log(`runtime: 1 copia — ${copies[0]}`);
  process.exit(0);
}

if (copies.length === 0) {
  console.error(`FATAL: no se encontró ${TARGET}. ¿Falta npm install?`);
  process.exit(1);
}

console.error(`FATAL: ${copies.length} copias de ${TARGET}. Dos copias = dos clases StateValue,`);
console.error('y toda llamada a circuito falla con "expected instance of StateValue".');
for (const copy of copies) console.error(`  ${copy}`);
console.error('Arreglo: npm dedupe');
process.exit(1);
