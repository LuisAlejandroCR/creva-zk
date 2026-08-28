// latency.ts (injected into the bboard-cli harness as bboard-cli/src/latency.ts)
// Reuses bboard-cli's own known-working setup (its config, its wallet provider,
// its wallet-utils) and replaces the interactive mainLoop with: deploy once,
// then time exactly one proveBacking call. Prints the latency in milliseconds
// and exits non-zero on any degraded result.

import { WebSocket } from "ws";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { unshieldedToken } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { Logger } from "pino";

import { StandaloneConfig } from "./config.js";
import { createLogger } from "./logger-utils.js";
import { MidnightWalletProvider } from "./midnight-wallet-provider.js";
import { waitForUnshieldedFunds } from "./wallet-utils.js";
import { CompiledBBoardContractContract, ledger, createBBoardPrivateState } from "../../contract/src/index.js";

// @ts-expect-error: needed to enable WebSocket usage through apollo (verbatim from bboard-cli/src/index.ts)
globalThis.WebSocket = WebSocket;

// Public test constant: the seed for the wallet funded by the local network's
// genesis block. Verbatim from bboard-cli/src/index.ts. Not a secret.
const GENESIS_MINT_WALLET_SEED = "0000000000000000000000000000000000000000000000000000000000000001";

const PRIVATE_STATE_ID = "bboardPrivateState";

// Synthetic demo data. 5000 >= 3000, so proveBacking must return true and set
// the `cleared` ledger flag. No real applicant, no real balance.
const SYNTHETIC_COLLATERAL = 5_000n;
const SYNTHETIC_REQUESTED_LIMIT = 3_000n;

type FailureReason =
  | "environment_unavailable"
  | "wallet_unavailable"
  | "deploy_failed"
  | "call_failed"
  | "ledger_unreadable";

type Degraded = { readonly step: string; readonly reason: FailureReason };

type Report =
  | {
      readonly status: "ok";
      readonly environmentColdStartMs: number;
      readonly deployMs: number;
      readonly callMs: number;
      readonly result: boolean;
      readonly cleared: boolean;
      readonly answered: string;
    }
  | { readonly status: "degraded"; readonly degraded: Degraded };

const degraded = (step: string, reason: FailureReason): Report => ({
  status: "degraded",
  degraded: { step, reason },
});

async function measure<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

async function run(logger: Logger): Promise<Report> {
  const config = new StandaloneConfig();
  const testEnv = config.getEnvironment(logger);
  let walletProvider: MidnightWalletProvider | undefined;

  try {
    let environmentColdStartMs: number;
    let providers;

    try {
      const started = await measure(async () => {
        const envConfiguration = await testEnv.start();
        logger.info(`Environment started: ${JSON.stringify(envConfiguration)}`);

        walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, GENESIS_MINT_WALLET_SEED);
        await walletProvider.start();

        const unshielded = await waitForUnshieldedFunds(
          logger,
          walletProvider.wallet,
          envConfiguration,
          unshieldedToken(),
        );
        logger.info(`NIGHT balance: ${unshielded.balances[unshieldedToken().raw]}`);
        return envConfiguration;
      });
      environmentColdStartMs = started.ms;

      const envConfiguration = started.value;
      const zkConfigProvider = new NodeZkConfigProvider<"proveBacking">(config.zkConfigPath);
      providers = {
        privateStateProvider: levelPrivateStateProvider({
          privateStateStoreName: config.privateStateStoreName,
          signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
          privateStoragePasswordProvider: () => "Bboard-Test-2026!",
          accountId: GENESIS_MINT_WALLET_SEED,
        }),
        publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
        zkConfigProvider,
        proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
        walletProvider: walletProvider!,
        midnightProvider: walletProvider!,
      };
    } catch (e) {
      logger.error({ err: e }, "local network or genesis wallet failed to come up");
      return degraded("start", walletProvider === undefined ? "environment_unavailable" : "wallet_unavailable");
    }

    let deployed;
    let deployMs: number;
    try {
      const d = await measure(() =>
        deployContract(providers as never, {
          compiledContract: CompiledBBoardContractContract,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState: createBBoardPrivateState(SYNTHETIC_COLLATERAL),
        } as never),
      );
      deployed = d.value as { callTx: Record<string, (arg: bigint) => Promise<unknown>>; deployTxData: any };
      deployMs = d.ms;
      logger.info(`Deployed at ${deployed.deployTxData.public.contractAddress} in ${deployMs.toFixed(1)}ms`);
    } catch (e) {
      logger.error({ err: e }, "deployContract failed");
      return degraded("deploy", "deploy_failed");
    }

    // ================== THE MEASUREMENT ==================
    // Nothing between the two marks but the circuit call itself: no human
    // input, no logging, no unrelated await, one process.
    let callTxData: any;
    let callMs: number;
    try {
      const callStart = performance.now();
      callTxData = await deployed.callTx.proveBacking(SYNTHETIC_REQUESTED_LIMIT);
      callMs = performance.now() - callStart;
    } catch (e) {
      logger.error({ err: e }, "proveBacking call failed");
      return degraded("call", "call_failed");
    }
    // =====================================================

    try {
      const contractAddress = deployed.deployTxData.public.contractAddress;
      const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
      if (contractState === null) {
        return degraded("ledger", "ledger_unreadable");
      }
      const ledgerState = ledger(contractState.data) as { cleared: boolean; answered: bigint };
      return {
        status: "ok",
        environmentColdStartMs,
        deployMs,
        callMs,
        result: Boolean(callTxData.private.result),
        cleared: ledgerState.cleared,
        answered: ledgerState.answered.toString(),
      };
    } catch (e) {
      logger.error({ err: e }, "reading public ledger after the call failed");
      return degraded("ledger", "ledger_unreadable");
    }
  } finally {
    try {
      if (walletProvider) await walletProvider.stop();
      await testEnv.shutdown();
    } catch (e) {
      logger.error({ err: e }, "shutdown failed (measurement above is unaffected)");
    }
  }
}

const config = new StandaloneConfig();
const logger = await createLogger(config.logDir);
const report = await run(logger);

process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);

if (report.status === "degraded") {
  logger.error({ degraded: report.degraded }, "MEASUREMENT FAILED — no latency number produced");
  process.exit(1);
}

process.stdout.write(
  [
    "",
    "==================== PROOF LATENCY ====================",
    `  environment cold start : ${report.environmentColdStartMs.toFixed(1)} ms`,
    `  deployContract         : ${report.deployMs.toFixed(1)} ms`,
    `  proveBacking CALL      : ${report.callMs.toFixed(1)} ms   <-- THE NUMBER`,
    "",
    `  circuit returned       : ${report.result}`,
    `  ledger.cleared         : ${report.cleared}`,
    `  ledger.answered        : ${report.answered}`,
    "=======================================================",
    "",
  ].join("\n"),
);

if (report.callMs >= 70_000) {
  logger.warn(
    { callMs: report.callMs.toFixed(1) },
    "call latency is near 90s — the two-minute demo video is NOT filmable as designed",
  );
}
process.exit(0);
