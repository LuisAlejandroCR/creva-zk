// api/test/laceProofPort.test.ts
// Checks the browser-direct path against a fake dapp connector, a fake fetch
// and fake join/call seams: the five ways it can degrade are five distinct
// reasons, a wallet that answers everything gets a complete six-provider
// stack, and the last step JOINS a contract at a supplied address rather than
// deploying one. No browser, no Lace, no proof server and no compiled circuit
// are involved — this exercises the seam's contract, not a real proof.
//
// The last block covers the case a rejection never reaches: an external that
// NEVER answers. Those run on fake timers, one per step of the chain.

import { afterEach, describe, expect, it, vi } from "vitest";
import { validatePassword } from "@midnight-ntwrk/midnight-js-utils";
import type { ConnectedAPI, Configuration, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import {
  createLaceBackingPort,
  createLaceIdentityPort,
  prepareLaceStack,
  probeProofServer,
  PROOF_REQUEST_CONTENT_TYPE,
} from "../src/laceProofPort.js";
import { TIER_PROVEN_BY_CLEARED_BACKING } from "../src/backingClaim.js";
import { DEFAULT_LACE_NETWORK_ID, selectWallet, type ConnectorHost } from "../src/laceWallet.js";
import { ephemeralStoragePassword, FetchZkConfigProvider } from "../src/laceProviders.js";
import type { JubjubPoint } from "../src/proofPort.js";
import {
  DEFAULT_JOIN_TIMEOUT_MS,
  DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS,
  DEFAULT_WALLET_CONNECT_TIMEOUT_MS,
  DEFAULT_WALLET_QUERY_TIMEOUT_MS,
  TIMED_OUT,
  withTimeout,
} from "../src/timeouts.js";

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
  // Each of these makes one wallet call never settle — no answer, no
  // rejection — which is what a wedged extension actually does.
  readonly connectHangs?: boolean;
  readonly statusHangs?: boolean;
  readonly configurationHangs?: boolean;
  readonly addressesHang?: boolean;
}

// A promise that never settles, which no catch and no retry can rescue.
function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

function fakeWallet(options: FakeWalletOptions = {}): InitialAPI {
  const connectedNetworkId = options.connectedNetworkId ?? DEFAULT_LACE_NETWORK_ID;
  const connected = {
    getConnectionStatus: async () => {
      if (options.statusHangs === true) return never<never>();
      return options.disconnected === true
        ? ({ status: "disconnected" } as const)
        : ({ status: "connected", networkId: connectedNetworkId } as const);
    },
    getConfiguration: async () => {
      if (options.configurationHangs === true) return never<never>();
      return {
        ...CONFIGURATION,
        networkId: options.configurationNetworkId ?? connectedNetworkId,
      };
    },
    getShieldedAddresses: async () => {
      if (options.addressesHang === true) return never<never>();
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
      // Neither Authorize nor Cancel: the dialog that never comes back.
      if (options.connectHangs === true) return never<never>();
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

describe("browser-direct preflight: distinct degraded reasons", () => {
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

// A contract address is 64 hex characters with no 0x prefix — see
// assertIsContractAddress in @midnight-ntwrk/midnight-js-utils. Synthetic:
// nothing was ever deployed at it.
const SYNTHETIC_CONTRACT_ADDRESS = "ab".repeat(32);

// Stand-ins for the two steps contract.ts owns. Using them keeps every test
// here free of the compiled circuit, which is a build artifact this
// workspace cannot produce without the compact toolchain.
function fakeJoin(found: unknown = { callTx: {} }) {
  return vi.fn(async (..._args: unknown[]) => ({ status: "ok", value: found }) as never);
}

function fakeCall(cleared: boolean, answered = 3_000n) {
  return vi.fn(async (..._args: unknown[]) => ({ status: "ok", value: { cleared, answered } }) as never);
}

describe("the browser joins a contract; it never deploys one", () => {
  it("degrades contract_not_found when the build named no address", async () => {
    const join = fakeJoin();
    const port = createLaceBackingPort(options({ join, call: fakeCall(true) }));

    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "contract_not_found" },
    });
    // The point of the reason: nothing was attempted, and in particular
    // nothing was deployed from the browser.
    expect(join).not.toHaveBeenCalled();
  });

  it("degrades contract_not_found when the address is only whitespace", async () => {
    const join = fakeJoin();
    const port = createLaceBackingPort(options({ contractAddress: "   ", join, call: fakeCall(true) }));

    await expect(port.checkBacking(3_000n)).resolves.toMatchObject({
      degraded: { reason: "contract_not_found" },
    });
    expect(join).not.toHaveBeenCalled();
  });

  it("joins at the address the build supplied, with the collateral as private state", async () => {
    const join = fakeJoin();
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, collateralAmount: 5_000n, join, call: fakeCall(true) }),
    );

    await port.checkBacking(3_000n);

    expect(join).toHaveBeenCalledTimes(1);
    const [providers, address, collateral] = join.mock.calls[0] as [unknown, string, bigint];
    expect(address).toBe(SYNTHETIC_CONTRACT_ADDRESS);
    expect(collateral).toBe(5_000n);
    // The six providers built from the wallet, not a set of its own.
    expect(providers).toHaveProperty("zkConfigProvider");
  });

  it("produces a real tier when the joined contract's proof clears", async () => {
    const call = fakeCall(true);
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join: fakeJoin(), call }),
    );

    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "ok",
      value: TIER_PROVEN_BY_CLEARED_BACKING,
    });
    expect(call.mock.calls[0]?.[1]).toBe(3_000n);
  });

  it("answers 'none' when the proof runs and does not clear — an answer, not a malfunction", async () => {
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join: fakeJoin(), call: fakeCall(false, 0n) }),
    );

    await expect(port.checkBacking(9_000_000n)).resolves.toEqual({ status: "ok", value: "none" });
  });

  it("keeps the join's own reason but re-stamps the step as the port's", async () => {
    const join = vi.fn(async () => ({
      status: "degraded",
      degraded: { step: "join", reason: "contract_not_found" },
    }) as never);
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join, call: fakeCall(true) }),
    );

    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "contract_not_found" },
    });
  });

  it("passes a failed call through as call_failed, still on the port's own step", async () => {
    const call = vi.fn(async () => ({
      status: "degraded",
      degraded: { step: "call", reason: "call_failed" },
    }) as never);
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join: fakeJoin(), call }),
    );

    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "call_failed" },
    });
  });

  it("degrades rather than throwing when the join step breaks its own contract", async () => {
    const join = vi.fn(() => {
      throw new Error("the ledger blew up");
    });
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join, call: fakeCall(true) }),
    );

    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "call_failed" },
    });
  });

  it("never reaches the contract at all when the preflight already failed", async () => {
    const join = fakeJoin();
    const port = createLaceBackingPort(
      options({ connectorHost: {}, contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join, call: fakeCall(true) }),
    );

    await expect(port.checkBacking(3_000n)).resolves.toMatchObject({ degraded: { reason: "wallet_absent" } });
    expect(join).not.toHaveBeenCalled();
  });
});

describe("the proof server probe is a real cross-origin request", () => {
  it("sends the same content type the prover will, so the browser preflights", async () => {
    const seen: RequestInit[] = [];
    const doFetch = vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(init);
      return new Response(null, { status: 405 });
    }) as unknown as typeof fetch;

    await expect(probeProofServer("http://localhost:6300", doFetch, 1_000)).resolves.toBe(true);
    expect(seen[0]?.headers).toEqual({ "Content-Type": PROOF_REQUEST_CONTENT_TYPE });
    // The bug this replaced: an opaque `no-cors` response passed the probe
    // for a server that would reject the prover's own request.
    expect(seen[0]?.mode).toBeUndefined();
  });

  it("reports the failure it can see, and logs the error rather than swallowing it", async () => {
    const errors: Record<string, unknown>[] = [];
    const logger = { info: () => undefined, error: (obj: Record<string, unknown>) => errors.push(obj) };
    const rejecting = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await expect(probeProofServer("http://localhost:6300", rejecting, 1_000, logger)).resolves.toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.err).toBeInstanceOf(TypeError);
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

// One test per external step of the chain. Every one of them uses a promise
// that NEVER settles — no rejection to catch, no error to log — and asserts
// the step gives up inside its own budget with the degraded reason that
// already belongs to it. Fake timers, so the suite spends no real seconds.
describe("an external that never answers still ends the screen", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Reads whether a port call has settled without awaiting it, so a test can
  // ask the question one tick before the budget and one tick after.
  function track<T>(promise: Promise<T>): { settled: boolean; value?: T } {
    const state: { settled: boolean; value?: T } = { settled: false };
    void promise.then((value) => {
      state.settled = true;
      state.value = value;
    });
    return state;
  }

  async function degradesAt(
    port: Promise<unknown>,
    budgetMs: number,
    reason: string,
    step = "checkBacking",
  ): Promise<void> {
    const state = track(port);

    await vi.advanceTimersByTimeAsync(budgetMs - 1);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.settled).toBe(true);
    expect(state.value).toEqual({ status: "degraded", degraded: { step, reason } });
  }

  it("wallet.connect that never returns is wallet_locked, inside the dialog's budget", async () => {
    vi.useFakeTimers();
    const port = createLaceBackingPort(options({ connectorHost: host(fakeWallet({ connectHangs: true })) }));

    await degradesAt(port.checkBacking(3_000n), DEFAULT_WALLET_CONNECT_TIMEOUT_MS, "wallet_locked");
  });

  it("getConnectionStatus that never returns is wallet_locked, inside the query budget", async () => {
    vi.useFakeTimers();
    const port = createLaceBackingPort(options({ connectorHost: host(fakeWallet({ statusHangs: true })) }));

    await degradesAt(port.checkBacking(3_000n), DEFAULT_WALLET_QUERY_TIMEOUT_MS, "wallet_locked");
  });

  it("getConfiguration that never returns is wallet_locked, inside the query budget", async () => {
    vi.useFakeTimers();
    const port = createLaceBackingPort(options({ connectorHost: host(fakeWallet({ configurationHangs: true })) }));

    await degradesAt(port.checkBacking(3_000n), DEFAULT_WALLET_QUERY_TIMEOUT_MS, "wallet_locked");
  });

  it("getShieldedAddresses that never returns is wallet_locked, inside the query budget", async () => {
    vi.useFakeTimers();
    const port = createLaceBackingPort(options({ connectorHost: host(fakeWallet({ addressesHang: true })) }));

    await degradesAt(port.checkBacking(3_000n), DEFAULT_WALLET_QUERY_TIMEOUT_MS, "wallet_locked");
  });

  it("a proof server that accepts the connection and never answers is proof_server_unreachable", async () => {
    vi.useFakeTimers();
    // Deliberately ignores the abort signal: a socket that is open and
    // silent is not the same as a refused connection, and only the second
    // bound in probeProofServer ends this one.
    const silent = vi.fn(() => never<Response>()) as unknown as typeof fetch;
    const port = createLaceBackingPort(options({ fetchImpl: silent }));

    await degradesAt(port.checkBacking(3_000n), DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS, "proof_server_unreachable");
  });

  it("the same silence on the identity port ends on its own step", async () => {
    vi.useFakeTimers();
    const silent = vi.fn(() => never<Response>()) as unknown as typeof fetch;
    const port = createLaceIdentityPort(options({ fetchImpl: silent }));

    await degradesAt(
      port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH),
      DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS,
      "proof_server_unreachable",
      "checkIdentity",
    );
  });

  it("a join that never answers is contract_not_found, on the budget joinBacking spends", async () => {
    vi.useFakeTimers();
    // joinBacking owns that budget and already spends it through withTimeout
    // (see api/src/contract.ts); here it stands in for the compiled circuit,
    // which is a build artifact this suite deliberately never needs.
    const joinBudget = DEFAULT_JOIN_TIMEOUT_MS;
    const join = vi.fn(async (...args: unknown[]) => {
      const budget = (args[4] as number | undefined) ?? joinBudget;
      const found = await withTimeout(never<unknown>(), budget);
      return (found === TIMED_OUT
        ? { status: "degraded", degraded: { step: "join", reason: "contract_not_found" } }
        : { status: "ok", value: found }) as never;
    });
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join, call: fakeCall(true) }),
    );

    await degradesAt(port.checkBacking(3_000n), joinBudget, "contract_not_found");
  });

  it("puts NO budget on the proof itself: a slow prover is not a failure", async () => {
    vi.useFakeTimers();
    const call = vi.fn(() => never<never>());
    const port = createLaceBackingPort(
      options({ contractAddress: SYNTHETIC_CONTRACT_ADDRESS, join: fakeJoin(), call: call as never }),
    );
    const state = track(port.checkBacking(3_000n));

    // Ten minutes: many times the ~23.7s a proof costs here and longer than
    // any budget above. Cutting the proof off would invent a failure out of
    // a wait that was going to succeed.
    await vi.advanceTimersByTimeAsync(10 * 60 * 1_000);

    expect(call).toHaveBeenCalledTimes(1);
    expect(state.settled).toBe(false);
  });
});
