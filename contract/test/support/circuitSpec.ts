// circuitSpec.ts
// Test-only mirrors of the two predicates' public comparison logic, plus
// helpers for reading and structurally checking the .compact sources.
// They exist because this sandbox has no `compact` binary to compile and
// run the real circuits (see the task's "npm run verify cannot pass in a
// cloud sandbox" note) — the mirrors use only generic, caller-supplied
// thresholds, never a Creva-specific number.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const contractSrcDir = path.resolve(here, "../../src");

export function readCompactSource(fileName: string): string {
  return readFileSync(path.join(contractSrcDir, fileName), "utf8");
}

export type Tier = "NONE" | "BRONZE" | "SILVER" | "GOLD";

export interface TierThresholds {
  bronzeMin: bigint;
  silverMin: bigint;
  goldMin: bigint;
}

// Mirrors backing-tier.compact's proveBackingTier ternary chain exactly:
// collateral >= goldMin ? GOLD : collateral >= silverMin ? SILVER : ...
export function classifyBackingTier(collateral: bigint, thresholds: TierThresholds): Tier {
  if (collateral >= thresholds.goldMin) return "GOLD";
  if (collateral >= thresholds.silverMin) return "SILVER";
  if (collateral >= thresholds.bronzeMin) return "BRONZE";
  return "NONE";
}

export interface IdentityClaimSpec {
  verified: boolean;
  ofAge: boolean;
  taxId: string;
}

// Mirrors identity-check.compact's proveIdentity boolean AND exactly.
export function checkIdentity(claim: IdentityClaimSpec, expectedTaxIdHash: string): boolean {
  return claim.verified && claim.ofAge && claim.taxId === expectedTaxIdHash;
}

// Throws with a descriptive message unless `source` calls verifyAttestation
// inside an assert() before the first place it reads a claim field —
// i.e. a forged/unsigned attestation can never reach predicate logic.
export function assertVerificationPrecedesClaimUse(source: string, label: string): void {
  const assertIdx = source.search(/assert\(\s*verifyAttestation</);
  if (assertIdx === -1) {
    throw new Error(`${label}: no assert(verifyAttestation<...>) call found`);
  }
  const firstClaimUseIdx = source.indexOf(".payload.claim");
  if (firstClaimUseIdx !== -1 && firstClaimUseIdx < assertIdx) {
    throw new Error(`${label}: claim data is read before the signature is verified`);
  }
}

// Throws unless every assignment to a ledger field is either an inline
// disclose(...), an enum literal (PascalCase.PascalCase, e.g. Tier.NONE),
// or a reference to a local that was itself bound via `const x =
// disclose(...)` earlier in the file. Any other identifier — a witness
// call or a claim field read straight into the ledger — is rejected.
export function assertLedgerAssignmentsAreDisclosed(source: string, ledgerNames: string[], label: string): void {
  const discloseNames = new Set(
    [...source.matchAll(/const\s+(\w+)\s*=\s*disclose\(/g)].map((m) => m[1] as string),
  );
  const enumLiteral = /^[A-Z]\w*\.[A-Z]\w*;?\s*$/;

  const lines = source.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    for (const name of ledgerNames) {
      const assignPrefix = `${name} = `;
      if (trimmed.startsWith(assignPrefix)) {
        const rhs = trimmed.slice(assignPrefix.length);
        const isInlineDisclosed = rhs.startsWith("disclose(");
        const isEnumLiteral = enumLiteral.test(rhs);
        const isDisclosedLocal = discloseNames.has(rhs.replace(/;\s*$/, ""));
        if (!isInlineDisclosed && !isEnumLiteral && !isDisclosedLocal) {
          throw new Error(`${label}: ledger assignment "${trimmed}" is neither disclose()'d nor a known safe literal`);
        }
      }
    }
  }
}
