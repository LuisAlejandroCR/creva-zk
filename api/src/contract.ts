// api/src/contract.ts
// Deploy and call wrappers for the backing circuit, each returning a typed
// degraded result rather than throwing. The compiled contract itself is bound
// once in contract/src/index.ts and imported statically from there.

import { deployContract, type DeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { Logger } from "pino";
import { fileURLToPath } from "node:url";
import {
  CompiledBackingContract,
  createBackingPrivateState,
  ledger,
  type BackingPrivateState,
  type Contract as GeneratedContract,
} from "../../contract/src/index.js";
import type { ApiDegraded, ApiResult } from "./types.js";

export type { BackingPrivateState };
export { createBackingPrivateState };

export const BACKING_CIRCUIT_ID = "proveBacking";
export const BACKING_PRIVATE_STATE_ID = "backingPrivateState";

export type BackingContract = GeneratedContract<BackingPrivateState>;
export type BackingProviders = MidnightProviders<
  typeof BACKING_CIRCUIT_ID,
  typeof BACKING_PRIVATE_STATE_ID,
  BackingPrivateState
>;
export type DeployedBacking = DeployedContract<BackingContract>;

// Absolute, and deliberately so: this is the directory NodeZkConfigProvider
// reads prover/verifier keys from. The contract's own assets path stays
// relative to it — see contract/src/index.ts.
const ZK_CONFIG_DIR = fileURLToPath(new URL("../../contract/src/managed/backing", import.meta.url));

export function zkConfigPath(): string {
  return ZK_CONFIG_DIR;
}

export interface CallOutcome {
  readonly cleared: boolean;
  readonly answered: bigint;
}

// Deploys the backing contract with the given collateral held as
// witness-only private state. Never throws.
export async function deployBacking(
  providers: BackingProviders,
  collateralAmount: bigint,
  logger: Logger,
): Promise<ApiResult<DeployedBacking>> {
  try {
    const deployed = await deployContract(providers, {
      compiledContract: CompiledBackingContract,
      privateStateId: BACKING_PRIVATE_STATE_ID,
      initialPrivateState: createBackingPrivateState(collateralAmount),
    });
    return { status: "ok", value: deployed };
  } catch (error) {
    logger.error({ err: error }, "deployContract failed");
    return degraded("deploy", "deploy_failed");
  }
}

// Calls proveBacking(requestedLimit) and reads the resulting public ledger.
// Never throws — a proving or submission failure comes back degraded.
export async function callProveBacking(
  deployed: DeployedBacking,
  requestedLimit: bigint,
  logger: Logger,
): Promise<ApiResult<CallOutcome>> {
  try {
    const callTxData = await deployed.callTx.proveBacking(requestedLimit);
    // The generated `ledger` accepts a StateValue directly, so the public
    // state that came back with the call is read locally — no extra indexer
    // round trip after the measured window.
    const ledgerState = ledger(callTxData.public.nextContractState);
    return { status: "ok", value: { cleared: ledgerState.cleared, answered: ledgerState.answered } };
  } catch (error) {
    logger.error({ err: error }, "proveBacking call failed");
    return degraded("call", "call_failed");
  }
}

function degraded<T>(step: string, reason: ApiDegraded["reason"]): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason } };
}
