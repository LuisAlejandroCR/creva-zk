// api/test/laceProofPort.test.ts
// Checks the browser-direct path's preflight against a fake dapp connector
// and a fake fetch: the four ways it can degrade are four distinct reasons,
// and a wallet that answers everything correctly gets a complete six-provider
// stack built in-process. No browser, no Lace and no proof server are
// involved — this exercises the seam's contract, not a real proof.

import { describe, expect, it, vi } from "vitest";
import { validatePassword } from "@midnight-ntwrk/midnight-js-utils";
import type { ConnectedAPI, Configuration, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { createLaceBackingPort, createLaceIdentityPort, prepareLaceStack } from "../src/laceProofPort.js";
import { DEFAULT_LACE_NETWORK_ID, selectWallet, type ConnectorHost } from "../src/laceWallet.js";
import { ephemeralStoragePassword, FetchZkConfigProvider } from "../src/laceProviders.js";
import type { JubjubPoint } from "../src/proofPort.js";

// Synthetic public arguments only — no real issuer key, no real tax ID.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { x: 1n, y: 2n };
const SYNTHETIC_TAX_ID_HASH = "cd".repeat(32);

// Hex rather than Bech32m: parseCoinPublicKeyToHex accepts either, and a
// synthetic hex key keeps a fabricated address out of this repository.
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
  readonly rdns?: string;
  readonly connectRejects?: boolean;
  readonly connectedNetworkId?: string;
  readonly configurationNetworkId?: string;
  readonly disconnected?: boolean;
  readonly addressesReject?: boolean;
}

function fakeWallet(options: FakeWalletOptions = {}): InitialAPI {
  const connectedNetworkId = options.connectedNetworkId ?? DEFAULT_LACE_NETWORK_ID;
  const connected = {
    getConnectionStatus: async () =>
      options.disconnected === true
        ? ({ status: "disconnected" } as const)
        : ({ status: "connected", networkId: connectedNetworkId } as const),
    getConfiguration: async () => ({
      ...CONFIGURATION,
      networkId: options.configurationNetworkId ?? connectedNetworkId,
    }),
    getShieldedAddresses: async () => {
      if (options.addressesReject === true) throw new Error("permission not granted");
      return {
        shieldedAddress: "synthetic",
        shieldedCoinPublicKey: SYNTHETIC_COIN_PUBLIC_KEY,
        shieldedEncryptionPublicKey: SYNTHETIC_ENC_PUBLIC_KEY,
      };
    },
  } as unknown as ConnectedAPI;

  return {
    rdns: options.rdns ?? "io.lace.midnight",
    name: "Fake Lace",
    icon: "data:image/svg+xml;base64,",
    apiVersion: "4.0.1",
    connect: async () => {
      if (options.connectRejects === true) throw new Error("wallet is locked");
      return connected;
    },
  };
}

function host(wallet: InitialAPI): ConnectorHost {
  return { mnLace: wallet };
}

// Something is listening: any answer at all, including an opaque one.
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

function options(overrides: Record<string, unknown> = {}) {
  return {
    connectorHost: host(fakeWallet()),
    fetchImpl: proofServerUp,
    levelFactory: levelFactory as never,
    ...overrides,
  };
}

describe("browser-direct preflight: four distinct degraded reasons", () => {
  it("degrades wallet_absent when no wallet is injected", async () => {
    const result = await prepareLaceStack("checkBacking", options({ connectorHost: {} }));
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_absent" } });
  });

  it("degrades wallet_locked when connect rejects", async () => {
    const result = await prepareLaceStack("checkBacking", options({ connectorHost: host(fakeWallet({ connectRejects: true })) }));
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_locked" } });
  });

  it("degrades wallet_locked when the connection reports itself disconnected", async () => {
    const result = await prepareLaceStack("checkBacking", options({ connectorHost: host(fakeWallet({ disconnected: true })) }));
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_locked" } });
  });

  it("degrades wallet_wrong_network when the wallet is on another network", async () => {
    const result = await prepareLaceStack(
      "checkBacking",
      options({ connectorHost: host(fakeWallet({ connectedNetworkId: "mainnet" })) }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_wrong_network" } });
  });

  it("degrades wallet_wrong_network when only the configuration disagrees", async () => {
    const result = await prepareLaceStack(
      "checkBacking",
      options({ connectorHost: host(fakeWallet({ configurationNetworkId: "devnet" })) }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_wrong_network" } });
  });

  it("degrades proof_server_unreachable when nothing answers the local proof server", async () => {
    const result = await prepareLaceStack("checkBacking", options({ fetchImpl: proofServerDown }));
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "proof_server_unreachable" },
    });
  });

  it("checks the wallet before the proof server, so the reason names the first thing to fix", async () => {
    const result = await prepareLaceStack(
      "checkBacking",
      options({ connectorHost: {}, fetchImpl: proofServerDown }),
    );
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_absent" } });
  });

  it("degrades wallet_locked when the wallet refuses to hand over its addresses", async () => {
    const result = await prepareLaceStack("checkBacking", options({ connectorHost: host(fakeWallet({ addressesReject: true })) }));
    expect(result).toEqual({ status: "degraded", degraded: { step: "checkBacking", reason: "wallet_locked" } });
  });
});

describe("browser-direct provider stack", () => {
  it("builds all six providers from a wallet that answers everything", async () => {
    const result = await prepareLaceStack("checkBacking", options());

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const { providers, proofServerUrl } = result.value;
    expect(proofServerUrl).toBe("http://localhost:6300");
    expect(providers.privateStateProvider).toBeDefined();
    expect(providers.publicDataProvider).toBeDefined();
    expect(providers.zkConfigProvider).toBeInstanceOf(FetchZkConfigProvider);
    expect(providers.proofProvider).toBeDefined();
    expect(providers.walletProvider.getCoinPublicKey()).toBe(SYNTHETIC_COIN_PUBLIC_KEY);
    expect(providers.walletProvider.getEncryptionPublicKey()).toBe(SYNTHETIC_ENC_PUBLIC_KEY);
    expect(providers.midnightProvider).toBeDefined();
  });

  it("proves against the address the wallet reports, not the built-in default", async () => {
    const configured = fakeWallet();
    const result = await prepareLaceStack(
      "checkBacking",
      options({ connectorHost: host(configured), proofServerUrl: "http://localhost:9999" }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.value.proofServerUrl).toBe("http://localhost:9999");
  });
});

describe("lace ports", () => {
  it("passes a preflight degrade straight through on the backing port", async () => {
    const port = createLaceBackingPort(options({ connectorHost: {} }));
    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "wallet_absent" },
    });
  });

  it("passes a preflight degrade straight through on the identity port", async () => {
    const port = createLaceIdentityPort(options({ fetchImpl: proofServerDown }));
    await expect(port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "proof_server_unreachable" },
    });
  });

  // Deploy and call on top of the stack are the real port's unfinished
  // wiring. Until that lands this degrades honestly rather than inventing a
  // tier, and this test is the thing that will fail when it does land.
  it("degrades call_failed once the whole stack is up, because deploy/call is not wired yet", async () => {
    const port = createLaceBackingPort(options());
    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "call_failed" },
    });
  });

  it("never throws at the caller, whatever the wallet does", async () => {
    const exploding: ConnectorHost = {
      broken: {
        rdns: "io.lace.midnight",
        name: "Exploding",
        icon: "",
        apiVersion: "4.0.1",
        connect: () => {
          throw new Error("synchronous throw");
        },
      },
    };
    const port = createLaceIdentityPort(options({ connectorHost: exploding }));
    await expect(port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).resolves.toMatchObject({
      status: "degraded",
    });
  });
});

describe("wallet selection", () => {
  it("prefers the wallet whose rdns looks like Lace", () => {
    const lace = fakeWallet({ rdns: "io.lace.midnight" });
    const other = fakeWallet({ rdns: "com.example.wallet" });
    expect(selectWallet({ other, lace })).toBe(lace);
  });

  it("falls back to the only injected wallet when none looks like Lace", () => {
    const other = fakeWallet({ rdns: "com.example.wallet" });
    expect(selectWallet({ other })).toBe(other);
  });

  it("honours an explicit rdns and finds nothing when it does not match", () => {
    const lace = fakeWallet({ rdns: "io.lace.midnight" });
    expect(selectWallet({ lace }, "io.lace.midnight")).toBe(lace);
    expect(selectWallet({ lace }, "com.example.wallet")).toBeUndefined();
  });
});

describe("browser private-state password", () => {
  it("satisfies the provider's own password policy, every draw", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(() => validatePassword(ephemeralStoragePassword())).not.toThrow();
    }
  });

  it("is different on every call, so nothing is baked into the bundle", () => {
    expect(ephemeralStoragePassword()).not.toBe(ephemeralStoragePassword());
  });
});

describe("FetchZkConfigProvider", () => {
  it("reads the same layout NodeZkConfigProvider writes", async () => {
    const asked: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      asked.push(url);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new FetchZkConfigProvider<"proveBacking">("/zk/", fetchImpl);

    await provider.getProverKey("proveBacking");
    await provider.getVerifierKey("proveBacking");
    await provider.getZKIR("proveBacking");

    expect(asked).toEqual(["/zk/keys/proveBacking.prover", "/zk/keys/proveBacking.verifier", "/zk/zkir/proveBacking.bzkir"]);
  });

  it("refuses a circuit id that could climb out of the base URL", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const provider = new FetchZkConfigProvider<string>("/zk", fetchImpl);
    await expect(provider.getProverKey("../../secret")).rejects.toThrow(/invalid circuitId/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws on a non-2xx artifact response rather than handing back an error page", async () => {
    const fetchImpl = vi.fn(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    const provider = new FetchZkConfigProvider<"proveBacking">("/zk", fetchImpl);
    await expect(provider.getProverKey("proveBacking")).rejects.toThrow(/404/);
  });
});
