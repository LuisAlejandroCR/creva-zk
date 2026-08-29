// contract/src/schnorrWitness.ts
// Implements schnorr.compact's getSchnorrReduction witness. Deliberately
// free of any ./managed import so it compiles and is testable before the
// Compact toolchain has run, and generic over the ledger and private-state
// types so every predicate that verifies an attestation can reuse it.

import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

// The divisor schnorr.compact truncates the challenge by. transientHash
// returns a BLS12-381 scalar (~2^255) but ecMul needs one below the
// Jubjub subgroup order (~2^252.4), so the circuit asks the witness for
// the quotient and remainder of dividing by 2^248 and then checks the
// division itself.
export const TWO_248 = 1n << 248n;

// The circuit asserts q < 116, because floor((BLS12-381 scalar prime - 1)
// / 2^248) == 115. Any larger quotient means the input was not a field
// element and the proof would abort on the range assert.
export const MAX_QUOTIENT = 116n;

// Returns [quotient, remainder] with challengeHash == q * 2^248 + r and
// r < 2^248 — the two values schnorr.compact's range and reduction
// asserts check. This is plain integer division, not a reimplementation
// of any hash: the challenge itself is computed by the circuit.
export function schnorrReduction(challengeHash: bigint): [bigint, bigint] {
  return [challengeHash / TWO_248, challengeHash % TWO_248];
}

// The witness entry itself, in the shape midnight-js expects: takes a
// WitnessContext and returns [nextPrivateState, value]. It reads no
// private state and writes none — the reduction is a pure function of the
// challenge the circuit already holds.
export function getSchnorrReduction<L, PS>(
  { privateState }: WitnessContext<L, PS>,
  challengeHash: bigint,
): [PS, [bigint, bigint]] {
  return [privateState, schnorrReduction(challengeHash)];
}
