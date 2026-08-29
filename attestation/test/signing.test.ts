// signing.test.ts
// Round-trips SchnorrAttestationSigner over the real Jubjub curve: signs an
// attestation and checks it against schnorr.compact's own verification
// equation, using the Compact runtime's ecMulGenerator/ecAdd/ecMul and its
// transientHash. Also proves the signature is bound to the payload, the
// subject key and the issuer key.

import { describe, expect, it } from "vitest";
import {
  ecAdd,
  ecMul,
  ecMulGenerator,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  JUBJUB_ORDER,
  SchnorrAttestationSigner,
  truncateChallenge,
  verifyAttestationSignature,
} from "../src/signing.js";
import type { SignedPayload } from "../src/types.js";
import type { IdentityClaim } from "../src/identity/types.js";
import { identityChallenge, backingChallenge } from "./support/contractHasher.js";

const subjectKey = ecMulGenerator(4242n);
const claim: IdentityClaim = { verified: true, ofAge: true, taxId: "22".repeat(32) };
const payload: SignedPayload<IdentityClaim> = { subjectKey, claim };

describe("SchnorrAttestationSigner", () => {
  it("produces a signature that satisfies schnorrVerify's own equation", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 12_345n);

    const { announcement, response } = await signer.sign(payload);

    // Exactly what schnorr.compact asserts: G*s == R + pk*c, with c the
    // 248-bit truncation of the challenge. Written out here rather than
    // delegated to verifyAttestationSignature so this test checks the
    // signer against the circuit's equation, not against its own helper.
    const challenge = truncateChallenge(identityChallenge(payload, announcement, signer.publicKey));
    const lhs = ecMulGenerator(response);
    const rhs = ecAdd(announcement, ecMul(signer.publicKey, challenge));

    expect(lhs.x).toEqual(rhs.x);
    expect(lhs.y).toEqual(rhs.y);
  });

  it("produces a signature verifyAttestationSignature accepts", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 12_345n);

    const signature = await signer.sign(payload);

    expect(verifyAttestationSignature(identityChallenge, payload, signature, signer.publicKey)).toBe(true);
  });

  it("signs deterministically for the same payload and key", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 99n);

    const first = await signer.sign(payload);
    const second = await signer.sign(payload);

    expect(first).toEqual(second);
  });

  it("uses a different nonce for a different payload, so the key never leaks", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 99n);

    const first = await signer.sign(payload);
    const second = await signer.sign({ ...payload, claim: { ...claim, ofAge: false } });

    expect(first.announcement).not.toEqual(second.announcement);
  });

  it("rejects a signature after the claim is tampered with", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 7n);
    const signature = await signer.sign(payload);

    const tampered: SignedPayload<IdentityClaim> = { ...payload, claim: { ...claim, verified: false } };

    expect(verifyAttestationSignature(identityChallenge, tampered, signature, signer.publicKey)).toBe(false);
  });

  it("rejects a signature replayed for a different subject", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 7n);
    const signature = await signer.sign(payload);

    const replayed: SignedPayload<IdentityClaim> = { ...payload, subjectKey: ecMulGenerator(5150n) };

    expect(verifyAttestationSignature(identityChallenge, replayed, signature, signer.publicKey)).toBe(false);
  });

  it("rejects a signature checked against a different issuer's key", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 7n);
    const other = new SchnorrAttestationSigner(identityChallenge, 8n);

    const signature = await signer.sign(payload);

    expect(verifyAttestationSignature(identityChallenge, payload, signature, other.publicKey)).toBe(false);
  });

  it("rejects a response outside the scalar field", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 7n);
    const signature = await signer.sign(payload);

    expect(
      verifyAttestationSignature(
        identityChallenge,
        payload,
        { ...signature, response: signature.response + JUBJUB_ORDER },
        signer.publicKey,
      ),
    ).toBe(false);
  });

  it("round-trips a collateral claim through the backing predicate's hasher", async () => {
    const signer = new SchnorrAttestationSigner(backingChallenge, 31n);
    const collateralPayload = { subjectKey, claim: { collateral: 5_000_000n } };

    const signature = await signer.sign(collateralPayload);

    expect(verifyAttestationSignature(backingChallenge, collateralPayload, signature, signer.publicKey)).toBe(true);
  });

  it("emits a response the runtime will accept as a scalar", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 123_456_789n);

    const { response } = await signer.sign(payload);

    expect(response).toBeGreaterThanOrEqual(0n);
    expect(response).toBeLessThan(JUBJUB_ORDER);
    // ecMulGenerator throws on an out-of-range scalar, so this is the
    // runtime itself confirming the bound rather than arithmetic here.
    expect(() => ecMulGenerator(response)).not.toThrow();
  });
});
