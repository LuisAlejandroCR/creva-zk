// api/src/identityClaim.ts
// Builds the signed identity attestation the identity circuit reads as its
// private state. Synthetic on purpose: Creva's KYC provider signs nothing
// today, so the demo issues its own Schnorr key and attests to values that
// belong to nobody. The signature path is the real one — the same circuit
// verifies it either way.

import { SchnorrAttestationSigner } from "../../attestation/src/signing.js";
import type { AttestationChallenge } from "../../attestation/src/signing.js";
import type { JubjubPoint } from "./proofPort.js";

// Mirrors identity-check.compact's IdentityClaim as the generated binding
// types it: Bytes<32> is a Uint8Array, not hex.
export interface IdentityClaimBytes {
  readonly verified: boolean;
  readonly ofAge: boolean;
  readonly taxId: Uint8Array;
}

export interface IdentitySignedPayload {
  readonly subjectKey: JubjubPoint;
  readonly claim: IdentityClaimBytes;
}

// Synthetic demo tax-ID hash. 32 bytes of a fixed, obviously-invented
// pattern rather than a hash of anything: no real RFC is involved, and none
// can be recovered from it.
export const DEFAULT_TAX_ID_HEX = "c4e7a".padEnd(64, "0");

// Bytes<32>. Rejects anything that is not exactly 32 bytes of hex rather
// than padding it, because a silently padded hash would clear a predicate
// the caller never meant to state.
export function taxIdBytes(hex: string): Uint8Array {
  const normalised = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(normalised)) {
    throw new Error("expected a 32-byte hex tax-ID hash");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(normalised.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function taxIdHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// The subject the demo attestation is issued to. Any point on the curve
// works — the circuit only checks that the signature covers this field —
// and the generator is the one point every party can name without holding a
// secret for it.
export const DEMO_SUBJECT_KEY: JubjubPoint = { x: 0n, y: 1n };

export interface IssuedIdentity {
  readonly issuerKey: JubjubPoint;
  readonly attestation: {
    readonly payload: IdentitySignedPayload;
    readonly signature: { readonly announcement: JubjubPoint; readonly response: bigint };
  };
}

// Signs a claim through the contract's OWN challenge circuit, handed in by
// the caller as `challenge` — never a reimplementation of it here. Signer
// and verifier therefore agree by construction, which is the only reason a
// proof over this attestation clears instead of aborting.
export async function issueIdentityAttestation(
  challenge: AttestationChallenge<IdentityClaimBytes>,
  claim: IdentityClaimBytes,
  subjectKey: JubjubPoint = DEMO_SUBJECT_KEY,
  secretKey?: bigint,
): Promise<IssuedIdentity> {
  const signer = new SchnorrAttestationSigner<IdentityClaimBytes>(challenge, secretKey);
  const payload: IdentitySignedPayload = { subjectKey, claim };
  const signature = await signer.sign(payload);
  return { issuerKey: signer.publicKey, attestation: { payload, signature } };
}

// The claim the demo deployment holds: a verified adult whose tax-ID hash is
// the synthetic one above. All three values are invented.
export function defaultIdentityClaim(taxIdHexValue: string = DEFAULT_TAX_ID_HEX): IdentityClaimBytes {
  return { verified: true, ofAge: true, taxId: taxIdBytes(taxIdHexValue) };
}
