// contractHasher.ts
// Test-only stand-in for the compiled contract's `pureCircuits` bindings —
// identityAttestationChallenge and backingAttestationChallenge. Builds the
// two hashes verifyAttestation performs out of the Compact runtime's OWN
// transientHash and CompactType descriptors, the same primitives the
// compiler's generated bindings call, so a round trip through it exercises
// the real encoding rather than a hand-rolled hash.

import {
  CompactTypeBoolean,
  CompactTypeBytes,
  CompactTypeField,
  CompactTypeJubjubPoint,
  CompactTypeUnsignedInteger,
  CompactTypeVector,
  transientHash,
  type CompactType,
  type JubjubPoint,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { AttestationChallenge } from "../../src/signing.js";
import type { SignedPayload } from "../../src/types.js";
import type { IdentityClaim } from "../../src/identity/types.js";
import type { CollateralClaim } from "../../src/backing/types.js";

// A Compact struct's field-aligned encoding is its fields' encodings
// concatenated in declaration order — nothing else. Composing one here
// from the runtime's own leaf descriptors is what the compiler emits for
// a struct, which is why this fixture and a real binding agree.
function compactStruct<T extends object>(
  fields: readonly (readonly [keyof T, CompactType<never>])[],
): CompactType<T> {
  const [[, first]] = fields as readonly [readonly [keyof T, CompactType<never>]];
  return {
    alignment: () => fields.slice(1).reduce((acc, [, type]) => acc.concat(type.alignment()), first.alignment()),
    toValue: (value: T) => fields.flatMap(([key, type]) => type.toValue(value[key] as never)),
    // Never exercised: this fixture only ever hashes.
    fromValue: () => {
      throw new Error("contractHasher decodes nothing");
    },
  };
}

const FIELD = CompactTypeField as CompactType<never>;
const asLeaf = (type: unknown) => type as CompactType<never>;

// Mirrors schnorr.compact's SchnorrHashInput<1>.
interface SchnorrHashInput {
  readonly ann_x: bigint;
  readonly ann_y: bigint;
  readonly pk_x: bigint;
  readonly pk_y: bigint;
  readonly msg: bigint[];
}

const SchnorrHashInputType = compactStruct<SchnorrHashInput>([
  ["ann_x", FIELD],
  ["ann_y", FIELD],
  ["pk_x", FIELD],
  ["pk_y", FIELD],
  ["msg", asLeaf(new CompactTypeVector(1, CompactTypeField))],
]);

// Mirrors identity-check.compact's IdentityClaim: Boolean, Boolean,
// Bytes<32>. taxId travels as hex off the wire and is decoded here,
// because Bytes<32> is what the Compact struct actually holds.
const IdentityClaimType = compactStruct<{ verified: boolean; ofAge: boolean; taxId: Uint8Array }>([
  ["verified", asLeaf(CompactTypeBoolean)],
  ["ofAge", asLeaf(CompactTypeBoolean)],
  ["taxId", asLeaf(new CompactTypeBytes(32))],
]);

// Mirrors backing-tier.compact's BackingClaim: a single Uint<64>.
const BackingClaimType = compactStruct<{ collateral: bigint }>([
  ["collateral", asLeaf(new CompactTypeUnsignedInteger((1n << 64n) - 1n, 8))],
]);

// Mirrors Attestation.compact's SignedPayload<T>.
function signedPayloadType<C>(claimType: CompactType<C>): CompactType<{ subjectKey: JubjubPoint; claim: C }> {
  return compactStruct([
    ["subjectKey", asLeaf(CompactTypeJubjubPoint)],
    ["claim", asLeaf(claimType)],
  ]);
}

// Mirrors Attestation.compact's attestationChallenge<T>: the payload hash
// wrapped in a one-element Vector, then hashed with the two points.
function challengeOver<C, T>(
  claimType: CompactType<C>,
  toClaim: (claim: T) => C,
): AttestationChallenge<T> {
  const payloadType = signedPayloadType(claimType);
  return (payload: SignedPayload<T>, announcement: JubjubPoint, issuerKey: JubjubPoint) => {
    const message = transientHash(payloadType, {
      subjectKey: payload.subjectKey,
      claim: toClaim(payload.claim),
    });
    return transientHash<SchnorrHashInput>(SchnorrHashInputType, {
      ann_x: announcement.x,
      ann_y: announcement.y,
      pk_x: issuerKey.x,
      pk_y: issuerKey.y,
      msg: [message],
    });
  };
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Stands in for pureCircuits.identityAttestationChallenge.
export const identityChallenge: AttestationChallenge<IdentityClaim> = challengeOver(
  IdentityClaimType,
  (claim) => ({ verified: claim.verified, ofAge: claim.ofAge, taxId: hexToBytes(claim.taxId) }),
);

// Stands in for pureCircuits.backingAttestationChallenge.
export const backingChallenge: AttestationChallenge<CollateralClaim> = challengeOver(
  BackingClaimType,
  (claim) => ({ collateral: claim.collateral }),
);
