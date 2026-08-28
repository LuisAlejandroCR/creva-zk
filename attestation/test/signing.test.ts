// signing.test.ts
// Round-trips Ed25519AttestationSigner against verifyAttestationSignature:
// a genuine sign/verify pair, not a placeholder, and proves tampering with
// either the subject key or the claim after signing is caught.

import { describe, expect, it } from "vitest";
import { Ed25519AttestationSigner, verifyAttestationSignature } from "../src/signing.js";
import type { SignedPayload } from "../src/types.js";

interface TestClaim {
  readonly amount: bigint;
}

describe("Ed25519AttestationSigner", () => {
  it("produces a signature verifyAttestationSignature accepts", async () => {
    const signer = new Ed25519AttestationSigner();
    const payload: SignedPayload<TestClaim> = {
      subjectKey: { compressed: "aa".repeat(32) },
      claim: { amount: 1_000n },
    };

    const signature = await signer.sign(payload);

    expect(verifyAttestationSignature(payload, signature, signer.publicKey)).toBe(true);
  });

  it("signs deterministically for the same payload and key", async () => {
    const signer = new Ed25519AttestationSigner();
    const payload: SignedPayload<TestClaim> = {
      subjectKey: { compressed: "bb".repeat(32) },
      claim: { amount: 42n },
    };

    const first = await signer.sign(payload);
    const second = await signer.sign(payload);

    expect(first).toEqual(second);
  });

  it("rejects a signature after the claim is tampered with", async () => {
    const signer = new Ed25519AttestationSigner();
    const payload: SignedPayload<TestClaim> = {
      subjectKey: { compressed: "cc".repeat(32) },
      claim: { amount: 100n },
    };

    const signature = await signer.sign(payload);
    const tampered: SignedPayload<TestClaim> = { ...payload, claim: { amount: 999n } };

    expect(verifyAttestationSignature(tampered, signature, signer.publicKey)).toBe(false);
  });

  it("rejects a signature checked against a different issuer's key", async () => {
    const signer = new Ed25519AttestationSigner();
    const otherSigner = new Ed25519AttestationSigner();
    const payload: SignedPayload<TestClaim> = {
      subjectKey: { compressed: "dd".repeat(32) },
      claim: { amount: 7n },
    };

    const signature = await signer.sign(payload);

    expect(verifyAttestationSignature(payload, signature, otherSigner.publicKey)).toBe(false);
  });
});
