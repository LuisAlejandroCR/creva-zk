// types.ts
// Off-chain mirror of contract/src/Attestation.compact's shapes, plus the
// result envelope every issuer in this workspace returns. No chain/circuit
// SDK is imported here; adapters and signers hold the implementation-
// specific code.

// Mirrors Compact's JubjubPoint. Compact represents a point as an (x, y)
// Field pair; off the wire this workspace carries it as a single compressed
// hex string instead, the same way a real HTTP client would transmit a
// curve point — decompressing it into the (x, y) pair a circuit witness
// needs is the job of whatever builds that witness, not this issuer.
export interface JubjubPoint {
  readonly compressed: string; // hex
}

// Mirrors schnorr.compact's SchnorrSignature: an announcement point and a
// scalar response, the two values schnorrVerify checks against the
// issuer's key.
export interface SchnorrSignature {
  readonly announcement: JubjubPoint;
  readonly response: string; // hex
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
