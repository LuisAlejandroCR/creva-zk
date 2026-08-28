// identity-check.spec.ts
// The promise: the identity check is true only when verified, of age,
// and tax ID match all hold at once — and it is never anchored anywhere.

import { describe, expect, it } from "vitest";
import { checkIdentity, readCompactSource } from "../support/circuitSpec.js";

const claim = (overrides: Partial<{ verified: boolean; ofAge: boolean; taxId: string }> = {}) => ({
  verified: true,
  ofAge: true,
  taxId: "expected-hash",
  ...overrides,
});

describe("checkIdentity (mirrors proveIdentity)", () => {
  it("is true only when every condition holds", () => {
    expect(checkIdentity(claim(), "expected-hash")).toBe(true);
  });

  it("is false when not verified", () => {
    expect(checkIdentity(claim({ verified: false }), "expected-hash")).toBe(false);
  });

  it("is false when not of age", () => {
    expect(checkIdentity(claim({ ofAge: false }), "expected-hash")).toBe(false);
  });

  it("is false when the tax ID does not match", () => {
    expect(checkIdentity(claim({ taxId: "forged-hash" }), "expected-hash")).toBe(false);
  });

  it("is false when every condition fails at once", () => {
    expect(checkIdentity(claim({ verified: false, ofAge: false, taxId: "forged-hash" }), "expected-hash")).toBe(
      false,
    );
  });
});

describe("identity-check.compact source shape", () => {
  const source = readCompactSource("identity-check.compact");

  it("imports the shared Attestation primitive rather than redefining it", () => {
    expect(source).toMatch(/import Attestation;/);
  });

  it("verifies the attestation's signature before evaluating the claim", () => {
    expect(source).toMatch(/assert\(\s*verifyAttestation<IdentityClaim>\(att, issuerKey\)/);
  });

  it("combines all three checks with a boolean AND", () => {
    expect(source).toMatch(/claim\.verified && claim\.ofAge && claim\.taxId == expectedTaxIdHash/);
  });

  it("declares no ledger state at all — the outcome is never anchored", () => {
    expect(source).not.toMatch(/export ledger/);
    expect(source).not.toMatch(/\bconstructor\s*\(/);
  });
});
