// forger-cannot-attest.invariant.spec.ts
// The promise: no predicate ever reads a claim's fields before asserting
// that verifyAttestation accepted its signature — so a forged or
// unsigned attestation can never influence an outcome, no matter what
// values a malicious witness returns.
//
// This is a source-level static check, not a circuit execution, because
// this sandbox has no `compact` binary (see the task's environment note).

import { describe, expect, it } from "vitest";
import { assertVerificationPrecedesClaimUse, readCompactSource } from "../support/circuitSpec.js";

describe("Attestation.compact", () => {
  const source = readCompactSource("Attestation.compact");

  it("verifyAttestation performs a real cryptographic check, not a stub", () => {
    expect(source).toMatch(/schnorrVerify<1>\(msg, att\.signature, issuerKey\)/);
  });

  it("recomputes the signed message from the attestation's own fields", () => {
    expect(source).toMatch(/transientHash<SignedPayload<T>>\(att\.payload\)/);
  });
});

describe("backing-tier.compact", () => {
  const source = readCompactSource("backing-tier.compact");

  it("verifies before reading the collateral claim", () => {
    expect(() => assertVerificationPrecedesClaimUse(source, "backing-tier")).not.toThrow();
  });

  it("catches an injected bypass: reading the claim before verifying must fail the check", () => {
    const bypassed = [
      "const att = backingAttestation();",
      "const collateral = att.payload.claim.collateral;",
      "verifyAttestation<BackingClaim>(att, issuerKey);",
    ].join("\n");
    expect(() => assertVerificationPrecedesClaimUse(bypassed, "backing-tier")).toThrow(/read before the signature/);
  });

  it("catches a missing check entirely", () => {
    const noCheck = "const att = backingAttestation();\nconst collateral = att.payload.claim.collateral;";
    expect(() => assertVerificationPrecedesClaimUse(noCheck, "backing-tier")).toThrow(/no verifyAttestation/);
  });
});

describe("identity-check.compact", () => {
  const source = readCompactSource("identity-check.compact");

  it("verifies before reading the identity claim", () => {
    expect(() => assertVerificationPrecedesClaimUse(source, "identity-check")).not.toThrow();
  });
});
