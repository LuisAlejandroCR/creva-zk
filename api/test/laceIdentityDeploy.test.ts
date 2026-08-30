// api/test/laceIdentityDeploy.test.ts
// The operator-only IDENTITY deployment, against a fake dapp connector, a
// fake fetch and fake issue/deploy seams. What is pinned: it hands back BOTH
// values the build needs, it signs through the contract's own challenge
// rather than a second copy of that hash, every way it can fail comes back as
// a typed degraded reason rather than an exception, and a deployment that
// never answers is cut by the budget instead of hanging forever. No browser,
// no Lace, no proof server, no tDUST and no compiled circuit are involved.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectedAPI, Configuration, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import {
  deployIdentityWithLace,
  DEFAULT_DEPLOY_TIMEOUT_MS,
  IDENTITY_DEPLOY_STEP,
  type LaceIdentityDeployOptions,
} from "../src/laceDeploy.js";
import { DEFAULT_LACE_NETWORK_ID, type ConnectorHost } from "../src/laceWallet.js";
import { formatIssuerKey } from "../src/identityIssuerKey.js";
import type { JubjubPoint } from "../src/proofPort.js";
import type { ApiResult } from "../src/types.js";

// Synthetic throughout: a fabricated address, fabricated public keys, and an
// issuer key that is two small decimals rather than a real curve point.
const SYNTHETIC_CONTRACT_ADDRESS = "ef".repeat(32);
const SYNTHETIC_COIN_PUBLIC_KEY = "11".repeat(32);
const SYNTHETIC_ENC_PUBLIC_KEY = "22".repeat(32);
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { x: 12n, y: 34n };

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

const proofServerUp = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
const proofServerDown = vi.fn(async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

const levelFactory = vi.fn(() => {
  throw new Error("the private state store must not be opened by a unit test");
});

function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

// Stands in for the contract's own identityAttestationChallenge. It is only
// ever handed through to the issuer, never called here.
const fakeChallenge = (() => 0n) as never;

// Stands in for identityClaim.ts's issueIdentityAttestation. It records the
// challenge it was given, so the test can prove the signer was handed the
// contract's own circuit and not something this action built.
function fakeIssue(seen: { challenge?: unknown } = {}) {
  return (async (challenge: unknown) => {
    seen.challenge = challenge;
    return {
      issuerKey: SYNTHETIC_ISSUER_KEY,
      attestation: { payload: {}, signature: {} },
    };
  }) as never;
}

const deployedOk = {
  status: "ok",
  value: { deployTxData: { public: { contractAddress: SYNTHETIC_CONTRACT_ADDRESS } } },
};

function fakeDeploy(result: unknown): never {
  return (async () => result) as never;
}

function options(overrides: Record<string, unknown> = {}): LaceIdentityDeployOptions {
  return {
    connectorHost: host(fakeWallet()),
    fetchImpl: proofServerUp,
    levelFactory: levelFactory as never,
    challenge: fakeChallenge,
    issue: fakeIssue(),
    claim: (() => ({ verified: true, ofAge: true, taxId: new Uint8Array(32) })) as never,
    deployIdentity: fakeDeploy(deployedOk),
    ...overrides,
  } as LaceIdentityDeployOptions;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the deployment reports the two values a build cannot do without", () => {
  it("returns the address and the issuer key, and nothing else", async () => {
    const result = await deployIdentityWithLace(options());
    expect(result).toEqual({
      status: "ok",
      value: { contractAddress: SYNTHETIC_CONTRACT_ADDRESS, issuerKey: SYNTHETIC_ISSUER_KEY },
    });
  });

  it("hands back a key that formats as decimal (x, y), never hex", async () => {
    const result = await deployIdentityWithLace(options());
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(formatIssuerKey(result.value.issuerKey)).toMatch(/^[0-9]+:[0-9]+$/);
  });

  // The reason the proof clears later instead of aborting: the signer and
  // the verifier run the SAME hash, because it is the contract's own circuit.
  it("signs through the contract's own challenge circuit", async () => {
    const seen: { challenge?: unknown } = {};
    await deployIdentityWithLace(options({ issue: fakeIssue(seen), challenge: fakeChallenge }));
    expect(seen.challenge).toBe(fakeChallenge);
  });

  it("deploys the attestation it just issued as the contract's private state", async () => {
    const deployIdentity = vi.fn(async (_providers: unknown, _attestation: unknown, _logger: unknown) => deployedOk);
    await deployIdentityWithLace(options({ deployIdentity: deployIdentity as never }));
    expect(deployIdentity).toHaveBeenCalledTimes(1);
    expect(deployIdentity.mock.calls[0]?.[1]).toEqual({ payload: {}, signature: {} });
  });
});

describe("every failure is a typed degraded reason, never an exception", () => {
  it("degrades wallet_absent when no wallet is injected", async () => {
    const result = await deployIdentityWithLace(options({ connectorHost: {} }));
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "wallet_absent" },
    });
  });

  it("degrades wallet_locked when the wallet hands back no connection", async () => {
    const result = await deployIdentityWithLace(
      options({ connectorHost: host(fakeWallet({ connectRejects: true })) }),
    );
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "wallet_locked" },
    });
  });

  it("degrades wallet_wrong_network when the wallet is on another network", async () => {
    const result = await deployIdentityWithLace(
      options({ connectorHost: host(fakeWallet({ connectedNetworkId: "mainnet" })) }),
    );
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "wallet_wrong_network" },
    });
  });

  it("degrades proof_server_unreachable when nothing answers the local proof server", async () => {
    const result = await deployIdentityWithLace(options({ fetchImpl: proofServerDown }));
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "proof_server_unreachable" },
    });
  });

  it("degrades deploy_failed when the deployment itself degrades", async () => {
    const result = await deployIdentityWithLace(
      options({
        deployIdentity: fakeDeploy({ status: "degraded", degraded: { step: "deploy", reason: "deploy_failed" } }),
      }),
    );
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "deploy_failed" },
    });
  });

  it("degrades deploy_failed when the deployment throws instead of degrading", async () => {
    const deployIdentity = (async () => {
      throw new Error("insufficient funds");
    }) as never;
    const result = await deployIdentityWithLace(options({ deployIdentity }));
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "deploy_failed" },
    });
  });

  it("degrades deploy_failed when the deployment reports no address", async () => {
    const result = await deployIdentityWithLace(
      options({ deployIdentity: fakeDeploy({ status: "ok", value: { deployTxData: { public: {} } } }) }),
    );
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "deploy_failed" },
    });
  });

  // A signer that cannot draw randomness — a page with no Web Crypto — must
  // not surface as an exception either.
  it("degrades deploy_failed when issuing the attestation throws", async () => {
    const issue = (async () => {
      throw new Error("no Web Crypto in this host");
    }) as never;
    const result = await deployIdentityWithLace(options({ issue }));
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "deploy_failed" },
    });
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
    const result = await deployIdentityWithLace(options({ connectorHost: host(exploding) }));
    expect(result.status).toBe("degraded");
    if (result.status === "degraded") expect(result.degraded.step).toBe(IDENTITY_DEPLOY_STEP);
  });
});

describe("the budget cuts a deployment that never answers", () => {
  it("degrades deploy_failed once the budget is spent", async () => {
    vi.useFakeTimers();
    const pending: Promise<ApiResult<unknown>> = deployIdentityWithLace(
      options({ deployIdentity: (() => never()) as never, deployTimeoutMs: 1_000 }),
    );
    // The preflight and the signing are real promise work, not timers: let
    // them drain before the clock is moved past the deployment's own budget.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({
      status: "degraded",
      degraded: { step: IDENTITY_DEPLOY_STEP, reason: "deploy_failed" },
    });
  });

  it("spends the same budget the backing deployment does", () => {
    // The identity deployment costs the operator what the backing one costs:
    // a proof, a signing prompt someone has to read, and confirmation.
    expect(DEFAULT_DEPLOY_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000 + 19_000);
  });
});
