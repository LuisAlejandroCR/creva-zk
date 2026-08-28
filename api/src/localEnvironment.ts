// api/src/localEnvironment.ts
// Starts the local `undeployed` Midnight network (node, indexer, proof
// server via Docker) and the pre-funded genesis wallet on top of it, using
// @midnight-ntwrk/testkit-js the way example-bboard's standalone launcher
// does. Everything here is external (Docker, three containers, a wallet
// sync) so every entry point returns a typed degraded result instead of
// throwing.

import { getTestEnvironment, LocalTestEnvironment, type MidnightWalletProvider } from "@midnight-ntwrk/testkit-js";
import type { Logger } from "pino";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import type { ApiDegraded, ApiResult } from "./types.js";

export interface LocalEnvironmentHandle {
  readonly configuration: EnvironmentConfiguration;
  readonly walletProvider: MidnightWalletProvider;
  shutdown(): Promise<void>;
}

// Boots the local network and returns the genesis wallet, or a degraded
// result naming which of the two external dependents (the network, the
// wallet) failed. Never throws.
export async function startLocalEnvironment(logger: Logger): Promise<ApiResult<LocalEnvironmentHandle>> {
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
    const walletProvider = await environment.getMidnightWalletProvider();
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
