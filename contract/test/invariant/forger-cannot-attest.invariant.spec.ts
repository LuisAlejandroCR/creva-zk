// forger-cannot-attest.invariant.spec.ts
// The promise: no predicate ever reads a claim's fields before asserting
// that verifyAttestation accepted its signature — so a forged or
// unsigned attestation can never influence an outcome, no matter what
// values a malicious witness returns — and that the challenge the signer
// computes off-chain is the one this circuit checks, because both come
// from the same exported pure circuit.
//
// This is a source-level static check, not a circuit execution, because
// this sandbox has no `compact` binary (see the task's environment note).

import { describe, expect, it } from "vitest";
import { assertVerificationPrecedesClaimUse, readCompactSource } from "../support/circuitSpec.js";

describe("Attestation.compact", () => {
  const source = readCompactSource("Attestation.compact");

  it("verifyAttestation performs a real cryptographic check, not a stub", () => {
    expect(source).toMatch(/schnorrVerify<1>\(\s*attestationMessage<T>\(att\.payload\),\s*att\.signature,\s*issuerKey\)/);
  });

  it("recomputes the signed message from the attestation's own fields", () => {
    expect(source).toMatch(/circuit attestationMessage<T>\(payload: SignedPayload<T>\)/);
    expect(source).toMatch(/transientHash<SignedPayload<T>>\(payload\)/);
  });

  // The reason the off-chain signer can produce a signature this circuit
  // accepts: both sides obtain the challenge from the same exported pure
  // circuit, rather than from two copies of one formula.
  it("exports the message and challenge the off-chain signer calls", () => {
    expect(source).toMatch(/export pure circuit attestationMessage<T>/);
    expect(source).toMatch(/export pure circuit attestationChallenge<T>/);
  });

  it("composes the challenge exactly as verifyAttestation does", () => {
    expect(source).toMatch(/schnorrChallenge<1>\([\s\S]*?attestationMessage<T>\(payload\)\)/);
  });
});

describe("schnorr.compact", () => {
  const source = readCompactSource("schnorr.compact");

  // A challenge computed at the wrong message length hashes a different
  // struct, so a signature built from it would abort every proof. The
  // exported circuit must therefore be generic, exactly as schnorrVerify
  // is — never pinned to a length the verifier does not use.
  it("exports a challenge circuit generic over the message length", () => {
    expect(source).toMatch(/export pure circuit schnorrChallenge<#n>/);
    expect(source).not.toMatch(/schnorrChallenge\([\s\S]*?msg: Vector<4, Field>/);
  });

  it("makes schnorrVerify use that same circuit, so there is one challenge definition", () => {
    expect(source).toMatch(/const cFull: Field =\s*schnorrChallenge<n>\(/);
    // The hash must appear exactly once: inside schnorrChallenge itself.
    expect(source.match(/transientHash<SchnorrHashInput<n>>/g)).toHaveLength(1);
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
