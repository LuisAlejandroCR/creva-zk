// types.ts
// Off-chain mirror of contract/src/Attestation.compact's shapes, plus the
// result envelope every issuer in this workspace returns. Point and scalar
// types are the ones the Compact runtime itself uses, so a value built here
// is already the value a witness hands the circuit.

import type { JubjubPoint } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

// Re-exported rather than redeclared: this is Compact's own JubjubPoint,
// the (x, y) Field pair `jubjubPointX`/`jubjubPointY` read and a witness
// passes straight into verifyAttestation. Nothing compresses or
// decompresses a point anywhere in this workspace any more — there is no
// hex string to get wrong, and no decompression step left unowned.
export type { JubjubPoint };

// Mirrors schnorr.compact's SchnorrSignature: an announcement point and a
// scalar response, the two values schnorrVerify checks against the
// issuer's key. `response` is a Field, so it is a bigint here — never hex.
export interface SchnorrSignature {
  readonly announcement: JubjubPoint;
  readonly response: bigint;
}

// Mirrors Attestation.compact's SignedPayload<T>: exactly what the issuer
// signs, nothing more.
export interface SignedPayload<T> {
  readonly subjectKey: JubjubPoint;
  readonly claim: T;
}

// Mirrors Attestation.compact's Attestation<T>. This shape is fixed by the
// circuit side — no issuer-identifying field belongs on it, so a forged
// "origin" can never ride along inside something the circuit trusts.
export interface Attestation<T> {
  readonly payload: SignedPayload<T>;
  readonly signature: SchnorrSignature;
}

// Which issuer produced an attestation. Lives outside the Attestation<T>
// itself — the circuit's verifyAttestation call is identical either way,
// so this tag exists only for the UI to label a result "synthetic" on
// screen, never to change how a proof is built or checked.
export type IssuerOrigin = "synthetic" | "creva";

export interface IssuedAttestation<T> {
  readonly origin: IssuerOrigin;
  readonly attestation: Attestation<T>;
}

// Fixed set of degraded reasons. An issuer never surfaces a raw provider
// error message here — that could carry internal detail (endpoints, key
// material, stack fragments). Raw errors go to a logger, not the result.
export type IssuerFailureReason = "signer_unavailable" | "invalid_claim";

// A degraded result is the only failure mode an issuer may surface: never
// a thrown error, never a fabricated attestation.
export type IssuerResult<T> =
  | { readonly status: "issued"; readonly issued: IssuedAttestation<T> }
  | { readonly status: "degraded"; readonly reason: IssuerFailureReason };
