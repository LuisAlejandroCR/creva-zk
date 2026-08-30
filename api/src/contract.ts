// api/src/contract.ts
// Deploy, join and call wrappers for the backing circuit, each returning a
// typed degraded result rather than throwing. The compiled contract itself is
// bound once in contract/src/index.ts and imported statically from there.
//
// BROWSER-SAFE, on purpose. The browser-direct path joins the same contract
// with the same calls, so nothing here may reach node: — the filesystem path
// NodeZkConfigProvider needs lives in zkConfigPath.ts instead. What this file
// does pull in is the compiled circuit, which is WebAssembly, so it is only
// ever reached through a dynamic import.

import { deployContract, findDeployedContract, type DeployedContract, type FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import {
  CompiledBackingContract,
  createBackingPrivateState,
  ledger,
  type BackingPrivateState,
  type Contract as GeneratedContract,
} from "../../contract/src/index.js";
import type { PortLogger } from "./portLogger.js";
import { DEFAULT_JOIN_TIMEOUT_MS, TIMED_OUT, withTimeout } from "./timeouts.js";
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
// What joining produces. Every deployment is also a found contract, which is
// why the call below takes this and not the narrower type: one call path
// serves the CLI that deployed and the browser that joined.
export type FoundBacking = FoundContract<BackingContract>;

// Budgets and the bounded-wait helper live in timeouts.js, which the
// browser-direct path shares. Re-exported here because this is where callers
// of joinBacking already look for it.
export { DEFAULT_JOIN_TIMEOUT_MS };

export interface CallOutcome {
  readonly cleared: boolean;
  readonly answered: bigint;
}

// Deploys the backing contract with the given collateral held as
// witness-only private state. Never throws.
export async function deployBacking(
  providers: BackingProviders,
  collateralAmount: bigint,
  logger: PortLogger,
): Promise<ApiResult<DeployedBacking>> {
  try {
    const deployed = await deployContract(providers, {
      compiledContract: CompiledBackingContract,
      privateStateId: BACKING_PRIVATE_STATE_ID,
      initialPrivateState: createBackingPrivateState(collateralAmount),
    });
    return { status: "ok", value: deployed };
  } catch (error) {
    logger.error?.({ err: error }, "deployContract failed");
    return degraded("deploy", "deploy_failed");
  }
}

// Joins a contract someone else already deployed, at a known address, and
// stores this caller's own collateral as the witness-only private state the
// circuit will read. Never throws: a malformed address, an address with
// nothing at it, an indexer that never answers and a contract whose verifier
// keys do not match this build all come back as the same contract_not_found
// — they are one thing to the user, "the contract this page was pointed at
// is not there", and the raw reason goes to the logger.
export async function joinBacking(
  providers: BackingProviders,
  contractAddress: string,
  collateralAmount: bigint,
  logger: PortLogger,
  timeoutMs?: number,
): Promise<ApiResult<FoundBacking>> {
  const budget = timeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS;
  try {
    assertIsContractAddress(contractAddress);
    const found = await withTimeout(
      findDeployedContract(providers, {
        compiledContract: CompiledBackingContract,
        contractAddress,
        privateStateId: BACKING_PRIVATE_STATE_ID,
        initialPrivateState: createBackingPrivateState(collateralAmount),
      }),
      budget,
    );
    if (found === TIMED_OUT) {
      logger.error?.({ timeoutMs: budget }, "findDeployedContract never answered — no deployment at that address?");
      return degraded("join", "contract_not_found");
    }
    return { status: "ok", value: found };
  } catch (error) {
    logger.error?.({ err: error }, "findDeployedContract failed");
    return degraded("join", "contract_not_found");
  }
}

// Calls proveBacking(requestedLimit) and reads the resulting public ledger.
// Never throws — a proving or submission failure comes back degraded.
//
// DELIBERATELY UNBOUNDED. A real proof takes ~23.7s here and longer on a
// phone; a budget on the proof itself would invent a failure out of a wait
// that was going to succeed. What is bounded is reaching the proof server
// (see probeProofServer), never waiting for the proof.
export async function callProveBacking(
  deployed: FoundBacking,
  requestedLimit: bigint,
  logger: PortLogger,
): Promise<ApiResult<CallOutcome>> {
  try {
    const callTxData = await deployed.callTx.proveBacking(requestedLimit);
    // The generated `ledger` accepts a StateValue directly, so the public
    // state that came back with the call is read locally — no extra indexer
    // round trip after the measured window.
    const ledgerState = ledger(callTxData.public.nextContractState);
    return { status: "ok", value: { cleared: ledgerState.cleared, answered: ledgerState.answered } };
  } catch (error) {
    logger.error?.({ err: error }, "proveBacking call failed");
    return degraded("call", "call_failed");
  }
}

function degraded<T>(step: string, reason: ApiDegraded["reason"]): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason } };
}
