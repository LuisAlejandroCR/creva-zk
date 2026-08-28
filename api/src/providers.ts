// api/src/providers.ts
// Wires the six MidnightProviders the contract call layer needs, in the
// same shape as example-bboard's bboard-cli: a LevelDB-backed private
// state provider, the indexer as public data provider, a filesystem ZK
// config provider pointed at the compiled circuit's keys, an HTTP proof
// server client, and the genesis wallet acting as both wallet and
// midnight provider.

import { randomBytes } from "node:crypto";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { EnvironmentConfiguration, MidnightWalletProvider } from "@midnight-ntwrk/testkit-js";

// Storage is a fresh LevelDB per demo run (not committed, not reused
// across accounts), so the encryption password only needs to satisfy
// levelPrivateStateProvider's strength policy and stay stable for the
// run's own lifetime. It is generated once per process, never hardcoded,
// and never written to the repo.
function ephemeralStoragePasswordProvider(): () => string {
  const password = `creva-zk-${randomBytes(16).toString("hex")}-Aa!`;
  return () => password;
}

// Scopes the local private-state store. Not a secret: it only namespaces
// on-disk storage paths, it never identifies a real account.
const ACCOUNT_ID = "creva-zk-api-demo";

export function createProviders<CircuitId extends string, PrivateState>(
  environment: EnvironmentConfiguration,
  walletProvider: MidnightWalletProvider,
  zkConfigPath: string,
): MidnightProviders<CircuitId, string, PrivateState> {
  const zkConfigProvider = new NodeZkConfigProvider<CircuitId>(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStoragePasswordProvider: ephemeralStoragePasswordProvider(),
      accountId: ACCOUNT_ID,
    }),
    publicDataProvider: indexerPublicDataProvider(environment.indexer, environment.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(environment.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}
