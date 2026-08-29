// signing.ts
// The AttestationSigner port every issuer signs through, plus the Schnorr-
// over-Jubjub implementation the circuit actually accepts. Every curve
// operation here is the Compact runtime's own — the same ecMulGenerator /
// ecAdd / ecMul schnorr.compact compiles down to — and the challenge hash
// is supplied by the contract, never recomputed here.

import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import {
  ecAdd,
  ecMul,
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { SchnorrSignature, SignedPayload } from "./types.js";

// Order of the Jubjub prime-order subgroup: the modulus every scalar in a
// signature lives in. Verified against the runtime, not copied from a
// spec — ecMulGenerator(JUBJUB_ORDER) is the identity point (0, 1), and
// the runtime rejects any scalar >= this value outright.
export const JUBJUB_ORDER =
  6554484396890773809930967563523245729705921265872317281365359162392183254199n;

// schnorr.compact truncates the challenge to 248 bits before it reaches
// ecMul, because ecMul needs a scalar below JUBJUB_ORDER (~2^252.4) while
// transientHash returns a BLS12-381 scalar (~2^255). The signer must
// truncate identically or the two sides compute different challenges.
export const TWO_248 = 1n << 248n;

// Both hashes verifyAttestation performs — over the payload, then over
// the Schnorr challenge input — composed into the single value a signer
// needs. This is the contract's own `<predicate>AttestationChallenge` pure
// circuit, as TypeScript sees it.
//
// Wire the compiled binding straight into this slot:
//
//   pureCircuits.identityAttestationChallenge
//
// Signer and verifier then agree because they are running the same
// circuit, not because two copies of one formula were kept in step by
// hand. Nothing in this workspace hashes anything itself; in particular
// the encoding of the claim T, which only the circuit knows, never has to
// be restated here.
//
// Returns the FULL challenge. The signer truncates it to 248 bits, the
// same reduction schnorr.compact's getSchnorrReduction witness supplies.
export type AttestationChallenge<T> = (
  payload: SignedPayload<T>,
  announcement: JubjubPoint,
  issuerKey: JubjubPoint,
) => bigint;

export interface AttestationSigner<T> {
  readonly publicKey: JubjubPoint;
  sign(payload: SignedPayload<T>): Promise<SchnorrSignature>;
}

// Reduces a scalar into [1, JUBJUB_ORDER). Zero is excluded because a zero
// nonce would publish the secret key in the response, and a zero secret
// key has no corresponding public key on the curve.
function toNonZeroScalar(value: bigint): bigint {
  const reduced = ((value % JUBJUB_ORDER) + JUBJUB_ORDER) % JUBJUB_ORDER;
  return reduced === 0n ? 1n : reduced;
}

// Derives the per-signature nonce from the secret key and the message,
// the way Ed25519 and RFC 6979 do: no entropy source is consulted, so the
// same key signing the same payload always produces the same signature,
// and a caller can never weaken the signature by supplying a bad RNG.
// Reusing a nonce across two messages would leak the secret key, which is
// exactly what binding it to a commitment over the payload prevents.
//
// Deliberately NOT the contract's challenge circuit: the nonce is the
// signer's own business, the verifier never recomputes it, and routing a
// secret key through a circuit binding would put it somewhere it has no
// reason to be. A plain domain-separated SHA-512 is the right tool.
function deriveNonce(secretKey: bigint, payloadCommitment: bigint): bigint {
  const hash = createHash("sha512")
    .update("creva-zk:schnorr-nonce:v1")
    .update(toScalarBytes(secretKey))
    .update(toScalarBytes(payloadCommitment))
    .digest();
  return toNonZeroScalar(bytesToBigInt(hash));
}

// The curve's identity element, used as a stand-in announcement to get a
// payload- and key-bound commitment out of the challenge circuit before
// the real announcement exists. The nonce has to depend on the payload,
// and the payload's own hash is inside the circuit — this is how to reach
// it without a second binding. It never appears in a signature.
const IDENTITY_POINT: JubjubPoint = { x: 0n, y: 1n };

// Fixed 32-byte big-endian encoding, so two different scalars can never
// feed the nonce hash the same bytes.
function toScalarBytes(value: bigint): Buffer {
  const out = Buffer.alloc(32);
  let v = value;
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (const byte of bytes) acc = (acc << 8n) | BigInt(byte);
  return acc;
}

export class SchnorrAttestationSigner<T> implements AttestationSigner<T> {
  readonly publicKey: JubjubPoint;
  private readonly secretKey: bigint;

  constructor(
    private readonly challenge: AttestationChallenge<T>,
    secretKey: bigint = SchnorrAttestationSigner.generateSecretKey(),
  ) {
    // Normalised once, here, so publicKey and every later signature are
    // derived from the same scalar the runtime will accept.
    this.secretKey = toNonZeroScalar(secretKey);
    this.publicKey = ecMulGenerator(this.secretKey);
  }

  // A uniformly random scalar in [1, JUBJUB_ORDER). Drawn from 64 bytes
  // rather than 32 so the modular reduction's bias is negligible.
  static generateSecretKey(seed: Uint8Array = nodeRandomBytes(64)): bigint {
    return toNonZeroScalar(bytesToBigInt(seed));
  }

  // Produces the (R, s) pair schnorrVerify checks as G*s == R + pk*c.
  // Every value below is computed the way the circuit computes it: the
  // challenge comes from the contract's own pure circuit, and the curve
  // operations are the runtime's.
  async sign(payload: SignedPayload<T>): Promise<SchnorrSignature> {
    const commitment = this.challenge(payload, IDENTITY_POINT, this.publicKey);
    const nonce = deriveNonce(this.secretKey, commitment);
    const announcement = ecMulGenerator(nonce);

    const c = truncateChallenge(this.challenge(payload, announcement, this.publicKey));

    // s = k + c*sk (mod L). Substituting into G*s gives G*k + (G*sk)*c,
    // which is exactly R + pk*c — the equation schnorrVerify asserts.
    const response = (nonce + c * this.secretKey) % JUBJUB_ORDER;
    return { announcement, response };
  }
}

// The 248-bit truncation schnorr.compact performs through its
// getSchnorrReduction witness: c = cFull mod 2^248. The witness side of
// that reduction — the (quotient, remainder) pair the circuit's asserts
// check — lives in contract/src/schnorrWitness.ts, which owns it; the
// signer only ever needs the remainder.
export function truncateChallenge(challengeHash: bigint): bigint {
  return challengeHash % TWO_248;
}

// Mirrors schnorr.compact's verification equation off-circuit, using the
// runtime's own curve operations and the contract's own challenge. The
// circuit remains the authority — this exists so a caller can reject a
// bad signature before paying for a proof, and so the round-trip test has
// something to check that is not a second copy of the signer's algebra.
export function verifyAttestationSignature<T>(
  challenge: AttestationChallenge<T>,
  payload: SignedPayload<T>,
  signature: SchnorrSignature,
  issuerKey: JubjubPoint,
): boolean {
  const { announcement, response } = signature;
  if (response < 0n || response >= JUBJUB_ORDER) return false;

  const c = truncateChallenge(challenge(payload, announcement, issuerKey));

  const lhs = ecMulGenerator(response);
  const rhs = ecAdd(announcement, ecMul(issuerKey, c));
  return lhs.x === rhs.x && lhs.y === rhs.y;
}
