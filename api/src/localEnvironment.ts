// api/src/localEnvironment.ts
// Starts the local `undeployed` Midnight network (node, indexer, proof
// server via Docker) and builds the genesis wallet on top of it. The wallet
// is built by hand rather than via LocalTestEnvironment.getMidnightWalletProvider()
// because that helper always uses testkit-js's default dust options
// (additionalFeeOverhead: 0n) — example-bboard's own flow overrides this to
// 500_000_000_000_000_000n for the `undeployed` network, which local circuit
// calls need. Everything here is external (Docker, three containers, a
// wallet sync) so every entry point returns a typed degraded result instead
// of throwing.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FluentWalletBuilder,
  getContainersConfiguration,
  getTestEnvironment,
  LocalTestEnvironment,
  MidnightWalletProvider,
  setContainersConfiguration,
  type DustWalletOptions,
  type EnvironmentConfiguration,
} from "@midnight-ntwrk/testkit-js";
import { DustSecretKey, LedgerParameters, ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { Logger } from "pino";
import type { ApiDegraded, ApiResult } from "./types.js";

export interface LocalEnvironmentHandle {
  readonly configuration: EnvironmentConfiguration;
  readonly walletProvider: MidnightWalletProvider;
  shutdown(): Promise<void>;
}

// The api workspace root, where compose.yml and the proof-server yml live.
const API_DIR = fileURLToPath(new URL("..", import.meta.url));

// testkit-js captures process.cwd() when its module is first evaluated and
// resolves compose.yml against that, so the demo would only work when
// launched from the api workspace. Pin the compose directory explicitly
// instead — process.chdir() cannot help, it runs after that capture.
function pinComposeDirectory(): void {
  const current = getContainersConfiguration();
  setContainersConfiguration({
    ...current,
    proofServer: { ...current.proofServer, path: API_DIR },
    standalone: { ...current.standalone, path: API_DIR },
    log: { ...current.log, path: path.resolve(API_DIR, "logs") },
  });
}

// Matches example-bboard's bboard-cli/src/midnight-wallet-provider.ts: on
// the local `undeployed` network, a call's fee/dust construction needs the
// larger overhead; 1_000n (testkit-js's implicit default is 0n) only holds
// up against a remote network's real fee market.
function dustOptionsFor(configuration: EnvironmentConfiguration): DustWalletOptions {
  return {
    ledgerParams: LedgerParameters.initialParameters(),
    additionalFeeOverhead: configuration.walletNetworkId === "undeployed" ? 500_000_000_000_000_000n : 1_000n,
    feeBlocksMargin: 5,
  };
}

// Boots the local network and builds the genesis wallet on it, or a
// degraded result naming which of the two external dependents (the
// network, the wallet) failed. Never throws.
export async function startLocalEnvironment(logger: Logger): Promise<ApiResult<LocalEnvironmentHandle>> {
  pinComposeDirectory();
  const environment = getTestEnvironment(logger);
  if (!(environment instanceof LocalTestEnvironment)) {
    return degraded("start", "environment_unavailable");
  }

  let configuration: EnvironmentConfiguration;
  try {
    configuration = await environment.start();
  } catch (error) {
    logger.error({ err: error }, "local network (docker) failed to start");
    return degraded("start_network", "environment_unavailable");
  }

  try {
    // The genesis seed LocalTestEnvironment itself uses — a public test
    // constant funded by the local network's genesis block (see
    // genesisWallet.ts). LocalTestEnvironment.getMidnightWalletProvider()
    // uses this same seed but without the dust options override above, so
    // it is read directly off the environment rather than duplicated here.
    const genesisSeed = environment.genesisMintWalletSeed[0];
    if (genesisSeed === undefined) {
      throw new Error("LocalTestEnvironment has no genesis wallet seed");
    }
    const { wallet, seeds, keystore } = await FluentWalletBuilder.forEnvironment(configuration)
      .withDustOptions(dustOptionsFor(configuration))
      .withSeed(genesisSeed)
      .buildWithoutStarting();

    const walletProvider = await MidnightWalletProvider.withWallet(
      logger,
      configuration,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
    // Waits for the wallet to sync and for NIGHT funds to arrive, and
    // registers NIGHT UTXOs for dust generation if needed — same as
    // example-bboard's explicit waitForUnshieldedFunds step.
    await walletProvider.start();

    return {
      status: "ok",
      value: {
        configuration,
        walletProvider,
        shutdown: () => environment.shutdown(),
      },
    };
  } catch (error) {
    logger.error({ err: error }, "genesis wallet failed to start or sync");
    try {
      await environment.shutdown();
    } catch {
      // best-effort cleanup only; the original failure is what we report
    }
    return degraded("start_wallet", "wallet_unavailable");
  }
}

function degraded(step: string, reason: ApiDegraded["reason"]): { status: "degraded"; degraded: ApiDegraded } {
  return { status: "degraded", degraded: { step, reason } };
}
