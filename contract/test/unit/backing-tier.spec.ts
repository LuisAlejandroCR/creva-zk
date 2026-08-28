// backing-tier.spec.ts
// The promise: collateral that clears a public threshold earns exactly
// the highest tier it clears, and never a lower or higher one.

import { describe, expect, it } from "vitest";
import { classifyBackingTier, readCompactSource } from "../support/circuitSpec.js";

const thresholds = { bronzeMin: 100n, silverMin: 500n, goldMin: 1_000n };

describe("classifyBackingTier (mirrors proveBackingTier)", () => {
  it("clears no tier below the bronze minimum", () => {
    expect(classifyBackingTier(99n, thresholds)).toBe("NONE");
    expect(classifyBackingTier(0n, thresholds)).toBe("NONE");
  });

  it("clears bronze exactly at the bronze minimum", () => {
    expect(classifyBackingTier(100n, thresholds)).toBe("BRONZE");
  });

  it("clears silver exactly at the silver minimum", () => {
    expect(classifyBackingTier(500n, thresholds)).toBe("SILVER");
  });

  it("clears gold exactly at the gold minimum and beyond", () => {
    expect(classifyBackingTier(1_000n, thresholds)).toBe("GOLD");
    expect(classifyBackingTier(1_000_000n, thresholds)).toBe("GOLD");
  });

  it("never reports a tier above what the collateral actually clears", () => {
    expect(classifyBackingTier(499n, thresholds)).toBe("BRONZE");
    expect(classifyBackingTier(999n, thresholds)).toBe("SILVER");
  });
});

describe("backing-tier.compact source shape", () => {
  const source = readCompactSource("backing-tier.compact");

  it("imports the shared Attestation primitive rather than redefining it", () => {
    expect(source).toMatch(/import Attestation;/);
  });

  it("verifies the attestation's signature before deriving a tier", () => {
    expect(source).toMatch(/assert\(\s*verifyAttestation<BackingClaim>\(att, issuerKey\)/);
  });

  it("discloses the tier and nothing else", () => {
    expect(source).toMatch(/const outcome = disclose\(/);
    expect(source).not.toMatch(/disclose\(collateral\)/);
  });

  it("exposes only the tier and a call counter on the ledger", () => {
    const ledgerFields = [...source.matchAll(/export ledger (\w+):/g)].map((m) => m[1]);
    expect(ledgerFields.sort()).toEqual(["answered", "tier"]);
  });
});
