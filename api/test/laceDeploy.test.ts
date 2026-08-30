// api/test/laceDeploy.test.ts
// Checks the operator-only deployment against a fake dapp connector, a fake
// fetch and a fake deploy seam: every way it can fail comes back as a typed
// degraded reason rather than an exception, the address it reports is the
// one the deployment produced, and a deployment that never answers is cut by
// the budget instead of hanging forever. No browser, no Lace, no proof
// server, no tDUST and no compiled circuit are involved.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectedAPI, Configuration, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { deployBackingWithLace, DEFAULT_DEPLOY_TIMEOUT_MS, DEPLOY_STEP } from "../src/laceDeploy.js";
import { DEFAULT_LACE_NETWORK_ID, type ConnectorHost } from "../src/laceWallet.js";
import type { ApiResult } from "../src/types.js";

// Synthetic throughout: a fabricated hex address and fabricated public keys,
// so no real deployment and no real wallet material is in this repository.
const SYNTHETIC_CONTRACT_ADDRESS = "ab".repeat(32);
const SYNTHETIC_COIN_PUBLIC_KEY = "11".repeat(32);
const SYNTHETIC_ENC_PUBLIC_KEY = "22".repeat(32);

const CONFIGURATION: Configuration = {
  indexerUri: "https://blockfrost.lw.iog.io/midnight-preprod",
  indexerWsUri: "wss://blockfrost.lw.iog.io/midnight-preprod",
  substrateNodeUri: "https://blockfrost.lw.iog.io/midnight-preprod-rpc",
  proverServerUri: "http://localhost:6300",
  networkId: DEFAULT_LACE_NETWORK_ID,
};

interface FakeWalletOptions {
  readonly connectRejects?: boolean;
  readonly connectedNetworkId?: string;
}

function fakeWallet(walletOptions: FakeWalletOptions = {}): InitialAPI {
  const connectedNetworkId = walletOptions.connectedNetworkId ?? DEFAULT_LACE_NETWORK_ID;
  const connected = {
    getConnectionStatus: async () => ({ status: "connected", networkId: connectedNetworkId }) as const,
    getConfiguration: async () => ({ ...CONFIGURATION, networkId: connectedNetworkId }),
    getShieldedAddresses: async () => ({
      shieldedAddress: "synthetic",
      shieldedCoinPublicKey: SYNTHETIC_COIN_PUBLIC_KEY,
      shieldedEncryptionPublicKey: SYNTHETIC_ENC_PUBLIC_KEY,
    }),
  } as unknown as ConnectedAPI;

  return {
    rdns: "io.lace.midnight",
    name: "Fake Lace",
    icon: "data:image/svg+xml;base64,",
    apiVersion: "4.0.1",
    connect: async () => {
      if (walletOptions.connectRejects === true) throw new Error("wallet is locked");
      return connected;
    },
  };
}

function host(wallet: InitialAPI): ConnectorHost {
  return { mnLace: wallet };
}

// Something is listening on the local proof server: any answer at all.
const proofServerUp = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
// Nothing is listening: what a browser raises for a refused connection.
const proofServerDown = vi.fn(async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

// Never opened: levelPrivateStateProvider builds its store lazily, so no
// test here ever needs IndexedDB.
const levelFactory = vi.fn(() => {
  throw new Error("the private state store must not be opened by a unit test");
});

// A promise that never settles — a deployment submitted to a network that
// never confirms it, which no catch and no retry can rescue.
function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

// Stands in for contract.ts's deployBacking. Only the address is read off
// the result, so only the address is modelled.
function fakeDeploy(result: unknown): never {
  return (async () => result) as never;
}

const deployedOk = {
  status: "ok",
  value: { deployTxData: { public: { contractAddress: SYNTHETIC_CONTRACT_ADDRESS } } },
};

function options(overrides: Record<string, unknown> = {}) {
  return {
    connectorHost: host(fakeWallet()),
    fetchImpl: proofServerUp,
    levelFactory: levelFactory as never,
    deploy: fakeDeploy(deployedOk),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the deployment reports an address that can be copied", () => {
  it("returns the address the deployment produced, and nothing else", async () => {
    const result = await deployBackingWithLace(options());
    expect(result).toEqual({ status: "ok", value: { contractAddress: SYNTHETIC_CONTRACT_ADDRESS } });
  });

  it("passes the collateral through to the deployment", async () => {
    const deploy = vi.fn(async (_providers: unknown, _collateral: bigint, _logger: unknown) => deployedOk);
    await deployBackingWithLace(options({ deploy: deploy as never, collateralAmount: 7_000n }));
    expect(deploy).toHaveBeenCalledTimes(1);
    expect(deploy.mock.calls[0]?.[1]).toBe(7_000n);
  });
});

describe("every failure is a typed degraded reason, never an exception", () => {
  it("degrades wallet_absent when no wallet is injected", async () => {
    const result = await deployBackingWithLace(options({ connectorHost: {} }));
    expect(result).toEqual({ status: "degraded", degraded: { step: DEPLOY_STEP, reason: "wallet_absent" } });
  });

  it("degrades wallet_locked when the wallet hands back no connection", async () => {
    const result = await deployBackingWithLace(
      options({ connectorHost: host(fakeWallet({ connectRejects: true })) }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: DEPLOY_STEP, reason: "wallet_locked" } });
  });

  it("degrades wallet_wrong_network when the wallet is on another network", async () => {
    const result = await deployBackingWithLace(
      options({ connectorHost: host(fakeWallet({ connectedNetworkId: "mainnet" })) }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: DEPLOY_STEP, reason: "wallet_wrong_network" } });
  });

  it("degrades proof_server_unreachable when nothing answers the local proof server", async () => {
    const result = await deployBackingWithLace(options({ fetchImpl: proofServerDown }));
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: DEPLOY_STEP, reason: "proof_server_unreachable" },
    });
  });

  // Insufficient funds and a refused signature both surface here: to
  // deployBacking they are one thing — the deployment did not happen.
  it("degrades deploy_failed when the deployment itself degrades", async () => {
    const result = await deployBackingWithLace(
      options({ deploy: fakeDeploy({ status: "degraded", degraded: { step: "deploy", reason: "deploy_failed" } }) }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: DEPLOY_STEP, reason: "deploy_failed" } });
  });

  it("degrades deploy_failed when the deployment throws instead of degrading", async () => {
    const deploy = (async () => {
      throw new Error("insufficient funds");
    }) as never;
    const result = await deployBackingWithLace(options({ deploy }));
    expect(result).toEqual({ status: "degraded", degraded: { step: DEPLOY_STEP, reason: "deploy_failed" } });
  });

  it("degrades deploy_failed when the deployment reports no address", async () => {
    const result = await deployBackingWithLace(
      options({ deploy: fakeDeploy({ status: "ok", value: { deployTxData: { public: {} } } }) }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: DEPLOY_STEP, reason: "deploy_failed" } });
  });

  it("never rejects, whatever the wallet does", async () => {
    const exploding = {
      rdns: "io.lace.midnight",
      name: "Exploding wallet",
      icon: "",
      apiVersion: "4.0.1",
      get connect(): never {
        throw new Error("the connector itself is broken");
      },
    } as unknown as InitialAPI;
    const result = await deployBackingWithLace(options({ connectorHost: host(exploding) }));
    // Which reason a broken connector lands on is the wallet layer's call
    // (wallet_locked here); what this asserts is the contract above it —
    // a typed degraded result at this action's own step, never a throw.
    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.step).toBe(DEPLOY_STEP);
    }
  });
});

describe("the budget cuts a deployment that never answers", () => {
  it("degrades deploy_failed once the budget is spent", async () => {
    vi.useFakeTimers();
    const pending: Promise<ApiResult<{ readonly contractAddress: string }>> = deployBackingWithLace(
      options({ deploy: (() => never()) as never, deployTimeoutMs: 1_000 }),
    );
    // The preflight is real promise work, not timers: let it drain before
    // the clock is moved past the deployment's own budget.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({
      status: "degraded",
      degraded: { step: DEPLOY_STEP, reason: "deploy_failed" },
    });
  });

  it("gives a deployment a budget generous enough to cover proving, signing and confirmation", () => {
    // Not an arbitrary number: it has to outlast the ~19s proof, the two
    // minutes a person is given to read Lace's signing prompt, and the
    // network's own confirmation on top of both.
    expect(DEFAULT_DEPLOY_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000 + 19_000);
  });
});
