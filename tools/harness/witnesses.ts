// witnesses.ts (injected into the bboard-cli harness as contract/src/witnesses.ts)
// The ONLY hand-edit the harness needs: renames example-bboard's witness to
// creva-zk's `collateralAmount` and re-types the private-state field bigint.
// Export NAMES are deliberately unchanged so contract/src/index.ts and
// api/src/common-types.ts compile untouched.

import { Ledger } from "./managed/bboard/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

// Same shape as example-bboard's BBoardPrivateState, carrying the collateral
// amount instead of a secret key. Name kept so nothing downstream changes.
export type BBoardPrivateState = {
  readonly secretKey: bigint;
};

export const createBBoardPrivateState = (secretKey: bigint) => ({
  secretKey,
});

// Structurally identical to example-bboard's `localSecretKey`: destructure
// privateState, return [nextPrivateState, value]. Only the key and the value
// type differ.
export const witnesses = {
  collateralAmount: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [BBoardPrivateState, bigint] => [
    privateState,
    privateState.secretKey,
  ],
};
