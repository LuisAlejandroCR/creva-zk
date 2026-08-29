// contract/src/identityWitnesses.ts
// The identity circuit's private state and its witness table: the signed
// attestation the issuer produced off-device, plus the shared Schnorr
// challenge reduction schnorrWitness.ts already owns.

import type { Ledger, Witnesses } from "./managed/identity-check/contract/index.js";
import { getSchnorrReduction } from "./schnorrWitness.js";

// Read off the generated witness signature rather than restated, so the
// struct this file hands the circuit cannot drift from the one Compact
// compiled. Index 1 of the tuple is the value the witness returns.
export type IdentityAttestation = ReturnType<Witnesses<unknown>["identityAttestation"]>[1];
export type IdentityClaimFields = IdentityAttestation["payload"]["claim"];

// The only hidden state the identity predicate needs. The claim inside —
// verified, ofAge and the tax id — never leaves the device: the circuit
// returns the conjunction of the three and nothing else.
export type IdentityPrivateState = {
  readonly attestation: IdentityAttestation;
};

export const createIdentityPrivateState = (attestation: IdentityAttestation): IdentityPrivateState => ({
  attestation,
});

// One entry per witness the generated Witnesses type declares. The
// attestation witness needs neither the ledger nor the contract address, so
// it destructures only privateState; the reduction is shared, not restated.
export const identityWitnesses: Witnesses<IdentityPrivateState> = {
  identityAttestation: ({ privateState }) => [privateState, privateState.attestation],
  getSchnorrReduction,
};

export type { Ledger as IdentityLedger };
