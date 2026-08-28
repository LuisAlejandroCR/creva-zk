// api/src/contract.ts
// Loads the compiled backing circuit and wraps deploy + proveBacking calls
// behind typed degraded results. The generated module under
// contract/src/managed/backing is loaded dynamically (never imported
// statically) so tsc never needs it to exist; it is validated at runtime.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CompiledContract, type Contract as CompactContractType } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { Logger } from "pino";
import type { ApiDegraded, ApiResult } from "./types.js";

export const BACKING_CIRCUIT_ID = "proveBacking";
export const BACKING_PRIVATE_STATE_ID = "backingPrivateState";

// The private state proveBacking's witness reads from: just the
// collateral amount, held on the caller's device and never disclosed.
export interface BackingPrivateState {
  readonly collateralAmount: bigint;
}

export interface BackingLedger {
  readonly cleared: boolean;
  readonly answered: bigint;
}

const CONTRACT_MODULE_URL = new URL("../../contract/src/managed/backing/contract/index.js", import.meta.url);
const ZK_CONFIG_DIR = fileURLToPath(new URL("../../contract/src/managed/backing", import.meta.url));

export function zkConfigPath(): string {
  return ZK_CONFIG_DIR;
}

export function isContractCompiled(): boolean {
  return existsSync(fileURLToPath(CONTRACT_MODULE_URL));
}

function backingWitnesses() {
  return {
    collateralAmount: (context: { privateState: BackingPrivateState }): [BackingPrivateState, bigint] => [
      context.privateState,
      context.privateState.collateralAmount,
    ],
  };
}

// The generated contract's type, expressed generically since no
// declaration file for it exists in this workspace (see file header).
type BackingContractType = CompactContractType<BackingPrivateState, ReturnType<typeof backingWitnesses>>;

// The subset of the compact compiler's generated module this file depends
// on: the contract constructor and the ledger state decoder. Typed loosely
// (see file header) — validated by usage, not by a declaration file that
// doesn't exist yet.
interface GeneratedBackingModule {
  readonly Contract: new (witnesses: unknown) => unknown;
  readonly ledger: (state: unknown) => BackingLedger;
}

export interface LoadedBackingContract {
  readonly compiledContract: unknown;
  readonly ledger: (state: unknown) => BackingLedger;
}

async function loadBackingContract(): Promise<ApiResult<LoadedBackingContract>> {
  if (!isContractCompiled()) {
    return degraded("load_contract", "contract_not_compiled");
  }
  try {
    const generated = (await import(CONTRACT_MODULE_URL.href)) as GeneratedBackingModule;
    const ctor = generated.Contract as unknown as new (
      witnesses: ReturnType<typeof backingWitnesses>,
    ) => BackingContractType;
    const compiledContract = CompiledContract.make<BackingContractType>("backing", ctor).pipe(
      CompiledContract.withWitnesses(backingWitnesses()),
      CompiledContract.withCompiledFileAssets(ZK_CONFIG_DIR),
    );
    return { status: "ok", value: { compiledContract, ledger: generated.ledger } };
  } catch {
    return degraded("load_contract", "contract_not_compiled");
  }
}

export interface DeployedBacking {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly deployedContract: any;
  readonly ledger: (state: unknown) => BackingLedger;
}

// Deploys the backing contract with the given collateral amount held as
// witness-only private state. Never throws.
export async function deployBacking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers: MidnightProviders<any, string, BackingPrivateState>,
  collateralAmount: bigint,
  logger: Logger,
): Promise<ApiResult<DeployedBacking>> {
  const loaded = await loadBackingContract();
  if (loaded.status === "degraded") return loaded;

  try {
    const deployedContract = await deployContract(providers as never, {
      compiledContract: loaded.value.compiledContract,
      privateStateId: BACKING_PRIVATE_STATE_ID,
      initialPrivateState: { collateralAmount },
    } as never);
    return { status: "ok", value: { deployedContract, ledger: loaded.value.ledger } };
  } catch (error) {
    logger.error({ err: error }, "deployContract failed");
    return degraded("deploy", "deploy_failed");
  }
}

export interface CallOutcome {
  readonly cleared: boolean;
  readonly answered: bigint;
}

// Calls proveBacking(requestedLimit) against an already-deployed contract
// and reads the public ledger back off the finalized call data. Never
// throws — a proving/submission failure comes back as a degraded result.
export async function callProveBacking(
  deployed: DeployedBacking,
  requestedLimit: bigint,
  logger: Logger,
): Promise<ApiResult<CallOutcome>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callTxData = await deployed.deployedContract.callTx[BACKING_CIRCUIT_ID](requestedLimit);
    const ledgerState = deployed.ledger(callTxData.public.nextContractState);
    return {
      status: "ok",
      value: { cleared: ledgerState.cleared, answered: ledgerState.answered },
    };
  } catch (error) {
    logger.error({ err: error }, "proveBacking call failed");
    return degraded("call", "call_failed");
  }
}

function degraded<T>(step: string, reason: ApiDegraded["reason"]): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason } };
}
