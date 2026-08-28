// contract/src/witnesses.ts
// The shape of the backing circuit's private state and the single witness
// that reads it. The collateral amount lives here and never leaves the
// device: the circuit discloses only the comparison outcome.

import { Ledger } from "./managed/backing/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

// The only hidden state the backing predicate needs. Both the generated
// contract and the midnight-js providers are parameterised by this type.
export type BackingPrivateState = {
  readonly collateralAmount: bigint;
};

export const createBackingPrivateState = (collateralAmount: bigint): BackingPrivateState => ({
  collateralAmount,
});

// One entry per witness declared in backing.compact. Each takes a
// WitnessContext first and returns [nextPrivateState, value]. This witness
// needs neither the ledger nor the contract address, so it destructures
// only privateState.
export const witnesses = {
  collateralAmount: ({
    privateState,
  }: WitnessContext<Ledger, BackingPrivateState>): [BackingPrivateState, bigint] => [
    privateState,
    privateState.collateralAmount,
  ],
};
