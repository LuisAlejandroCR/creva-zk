// signing.ts
// The AttestationSigner port every issuer signs through, plus one concrete
// implementation. Ed25519 is itself a Schnorr signature over a twisted
// Edwards curve — a signature already is an (R, s) pair, the same shape as
// SchnorrSignature's announcement+response — so it stands in for
// Midnight's actual JubJub curve and Poseidon-based transientHash
// challenge (contract/src/schnorr.compact), neither of which ships as an
// installable library outside the Compact toolchain this sandbox lacks
// (see the repository root README's toolchain note). Swapping in a real
// JubJub signer, once that toolchain is reachable, changes nothing on the
// calling side: every issuer here depends on AttestationSigner, never on
// Ed25519AttestationSigner directly.

import {
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from "node:crypto";
import type { JubjubPoint, SchnorrSignature, SignedPayload } from "./types.js";

// Domain-separates this signature from every other use of Ed25519 in the
// system, so a message signed here can never be replayed as one signed
// for an unrelated purpose.
const DOMAIN = Buffer.from("creva-zk:attestation:v1", "utf8");

// The fixed 12-byte ASN.1 prefix node:crypto puts in front of every raw
// 32-byte Ed25519 public key when exporting/importing SPKI DER.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// Canonical, deterministic byte encoding of a signed payload. Field order
// is spelled out explicitly rather than left to JSON.stringify's handling
// of whatever key order the caller happened to build the object in.
function encodePayload<T>(payload: SignedPayload<T>): Buffer {
  const canonical = JSON.stringify({
    subjectKey: payload.subjectKey.compressed,
    claim: payload.claim,
    // bigint fields (e.g. CollateralClaim.collateral) do not survive
    // JSON.stringify; replacer turns them into a tagged decimal string so
    // two payloads that differ only in a bigint claim field never encode
    // to the same bytes.
  }, (_key, value) => (typeof value === "bigint" ? `bigint:${value.toString()}` : value));
  return Buffer.concat([DOMAIN, Buffer.from(canonical, "utf8")]);
}

function publicKeyFromCompressed(point: JubjubPoint): KeyObject {
  const raw = Buffer.from(point.compressed, "hex");
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

export interface AttestationSigner {
  readonly publicKey: JubjubPoint;
  sign<T>(payload: SignedPayload<T>): Promise<SchnorrSignature>;
}

export class Ed25519AttestationSigner implements AttestationSigner {
  private readonly privateKey: KeyObject;
  readonly publicKey: JubjubPoint;

  constructor(keyPair: { readonly privateKey: KeyObject; readonly publicKey: KeyObject } = generateKeyPairSync("ed25519")) {
    this.privateKey = keyPair.privateKey;
    const raw = keyPair.publicKey.export({ type: "spki", format: "der" });
    this.publicKey = { compressed: raw.subarray(raw.length - 32).toString("hex") };
  }

  async sign<T>(payload: SignedPayload<T>): Promise<SchnorrSignature> {
    const message = encodePayload(payload);
    const signature = edSign(null, message, this.privateKey);
    return {
      announcement: { compressed: signature.subarray(0, 32).toString("hex") },
      response: signature.subarray(32, 64).toString("hex"),
    };
  }
}

// Mirrors Attestation.compact's verifyAttestation, off-circuit: recomputes
// the signed message from the attestation's own fields and checks it
// against the claimed public key. Exists for this workspace's own tests
// and for anyone integrating it who wants to sanity-check a signature
// before it reaches a real prover.
export function verifyAttestationSignature<T>(
  payload: SignedPayload<T>,
  signature: SchnorrSignature,
  issuerKey: JubjubPoint,
): boolean {
  const message = encodePayload(payload);
  const sigBytes = Buffer.concat([
    Buffer.from(signature.announcement.compressed, "hex"),
    Buffer.from(signature.response, "hex"),
  ]);
  return edVerify(null, message, publicKeyFromCompressed(issuerKey), sigBytes);
}
