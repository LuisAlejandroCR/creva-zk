// contract/src/identity.ts
// Binds the compiled identity circuit to its witnesses and its ZK assets, the
// way index.ts binds the backing one. Kept in its own module because both
// generated contracts export the same names — Contract, Ledger, pureCircuits
// — so only one of the two can be re-exported flat.

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import * as Generated from "./managed/identity-check/contract/index.js";
import { identityWitnesses, type IdentityPrivateState } from "./identityWitnesses.js";

export * from "./identityWitnesses.js";
export { schnorrReduction, getSchnorrReduction, MAX_QUOTIENT, TWO_248 } from "./schnorrWitness.js";
export type IdentityContract = Generated.Contract<IdentityPrivateState>;
export type IdentityLedgerState = Generated.Ledger;
export const identityLedger = Generated.ledger;

// The two pure circuits an off-chain issuer calls to obtain the exact message
// and challenge verifyAttestation recomputes. Exported from here so the signer
// never reimplements Compact's transientHash — see attestation/src/signing.ts.
export const identityPureCircuits = Generated.pureCircuits;

// Same instantiation expression as the backing binding, and for the same
// reason: passing the bare constructor erases the private-state type
// parameter, and the runtime then fails to build the state encoders.
export const CompiledIdentityContract = CompiledContract.make<
  Generated.Contract<IdentityPrivateState>
>("identity-check", Generated.Contract<IdentityPrivateState>).pipe(
  CompiledContract.withWitnesses(identityWitnesses),
  // Relative, resolved against the base path each provider is given.
  CompiledContract.withCompiledFileAssets("./managed/identity-check"),
);
