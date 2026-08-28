// Invariant: the compiled circuit must never widen what it discloses.
//
// backing.compact holds one witness — collateralAmount() — and discloses
// only the boolean outcome of comparing it against a public limit. If a
// future edit accidentally promotes the amount (or any other witness) onto
// the ledger, this is the test that has to fail.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LEDGER_DTS_PATH = fileURLToPath(
  new URL('../../contract/src/managed/backing/contract/index.d.ts', import.meta.url),
);

/**
 * Extracts the member names declared directly inside the named type,
 * interface, or class body in a .d.ts source, regardless of which of those
 * three the generator emits. Only top-level members are considered; nested
 * braces (method signatures, inline object types) are skipped over.
 */
function extractDeclaredMembers(source: string, typeName: string): string[] {
  const headMatch = source.match(
    new RegExp(`\\b(?:type|interface|class)\\s+${typeName}\\b[^{]*\\{`),
  );
  if (!headMatch || headMatch.index === undefined) {
    throw new Error(`No type/interface/class named "${typeName}" found in ${LEDGER_DTS_PATH}`);
  }

  const bodyStart = headMatch.index + headMatch[0].length;
  let depth = 1;
  let i = bodyStart;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  const body = source.slice(bodyStart, i - 1);

  const members: string[] = [];
  const memberPattern = /^\s*(?:readonly\s+|public\s+|private\s+|protected\s+|get\s+)*(\w+)\s*\??\s*[:(]/gm;
  let match: RegExpExecArray | null;
  while ((match = memberPattern.exec(body)) !== null) {
    members.push(match[1]);
  }
  return members;
}

describe('witness never reaches the ledger', () => {
  it('exposes exactly cleared and answered on the generated Ledger type, never the collateral amount', () => {
    const source = readFileSync(LEDGER_DTS_PATH, 'utf8');

    const members = extractDeclaredMembers(source, 'Ledger');

    expect(new Set(members)).toStrictEqual(new Set(['cleared', 'answered']));
  });
});
