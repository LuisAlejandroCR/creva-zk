// api/test/laceIdentityPort.test.ts
// The browser-direct IDENTITY port, against a fake dapp connector, a fake
// fetch and fake join/call seams. Three things are pinned here:
//
//   without BOTH build values — the identity contract's address and the
//   issuer key — nothing is joined at all, and the result is the same typed
//   contract_not_found the backing path gives without its address;
//   with both, proveIdentity is called with the BUILD's key and the demo
//   tax-ID hash, and its boolean comes back as a real answer, yes or no;
//   every failure below is a typed degraded reason, never an exception.
//
// No browser, no Lace, no proof server, no tDUST and no compiled circuit.

import { describe, expect, it, vi } from "vitest";
import type { ConnectedAPI, Configuration, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { createLaceIdentityPort, type LaceOptions } from "../src/laceProofPort.js";
import { DEFAULT_LACE_NETWORK_ID, type ConnectorHost } from "../src/laceWallet.js";
import { DEMO_TAX_ID_HEX } from "../src/identityDemo.js";
import type { JubjubPoint } from "../src/proofPort.js";

// Synthetic throughout: a fabricated address, fabricated public keys and the
// demo tax-ID hash identityDemo.ts owns. Nothing here is real material.
const SYNTHETIC_IDENTITY_ADDRESS = "cd".repeat(32);
const SYNTHETIC_COIN_PUBLIC_KEY = "11".repeat(32);
const SYNTHETIC_ENC_PUBLIC_KEY = "22".repeat(32);
// What the operator tool would have printed: the key the deployment's
// attestation was signed under.
const BUILD_ISSUER_KEY: JubjubPoint = { x: 7n, y: 9n };
// What the SCREEN hands the port. It is a stand-in the app invented, and the
// port must ignore it — naming it would make the circuit abort.
const SCREEN_ISSUER_KEY: JubjubPoint = { x: 1n, y: 2n };

const CONFIGURATION: Configuration = {
  indexerUri: "https://blockfrost.lw.iog.io/midnight-preprod",
  indexerWsUri: "wss://blockfrost.lw.iog.io/midnight-preprod",
  substrateNodeUri: "https://blockfrost.lw.iog.io/midnight-preprod-rpc",
  proverServerUri: "http://localhost:6300",
  networkId: DEFAULT_LACE_NETWORK_ID,
};

function fakeWallet(): InitialAPI {
  const connected = {
    getConnectionStatus: async () => ({ status: "connected", networkId: DEFAULT_LACE_NETWORK_ID }) as const,
    getConfiguration: async () => CONFIGURATION,
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
    connect: async () => connected,
  };
}

function host(): ConnectorHost {
  return { mnLace: fakeWallet() };
}

// Something is listening on the local proof server: any answer at all.
const proofServerUp = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
const proofServerDown = vi.fn(async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

// Never opened: no test here touches IndexedDB.
const levelFactory = vi.fn(() => {
  throw new Error("the private state store must not be opened by a unit test");
});

const joinedContract = { callTx: {} };

function options(overrides: Record<string, unknown> = {}): LaceOptions {
  return {
    connectorHost: host(),
    fetchImpl: proofServerUp,
    levelFactory: levelFactory as never,
    identityContractAddress: SYNTHETIC_IDENTITY_ADDRESS,
    identityIssuerKey: BUILD_ISSUER_KEY,
    joinIdentity: (async () => ({ status: "ok", value: joinedContract })) as never,
    callIdentity: (async () => ({ status: "ok", value: { matched: true, answered: 1n } })) as never,
    ...overrides,
  } as LaceOptions;
}

describe("without both build values nothing is joined", () => {
  // The whole point: no address and no key means this build was never pointed
  // at a deployment, so the port must not reach the contract at all.
  const cases = [
    ["neither variable", { identityContractAddress: undefined, identityIssuerKey: undefined }],
    ["only the address", { identityIssuerKey: undefined }],
    ["only the issuer key", { identityContractAddress: undefined }],
    ["an empty address", { identityContractAddress: "" }],
    ["an address that is only whitespace", { identityContractAddress: "   " }],
  ] as const;

  for (const [label, overrides] of cases) {
    it(`degrades contract_not_found and never joins with ${label}`, async () => {
      const joinIdentity = vi.fn(async () => ({ status: "ok", value: joinedContract }));
      const callIdentity = vi.fn(async () => ({ status: "ok", value: { matched: true, answered: 1n } }));

      const port = createLaceIdentityPort(
        options({ ...overrides, joinIdentity: joinIdentity as never, callIdentity: callIdentity as never }),
      );
      const result = await port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX);

      expect(result).toEqual({
        status: "degraded",
        degraded: { step: "checkIdentity", reason: "contract_not_found" },
      });
      expect(joinIdentity).not.toHaveBeenCalled();
      expect(callIdentity).not.toHaveBeenCalled();
    });
  }
});

describe("with both values the port joins and answers with the circuit's boolean", () => {
  it("joins the address the build named", async () => {
    const joinIdentity = vi.fn(async (_providers: unknown, _address: string, _logger: unknown) => ({
      status: "ok",
      value: joinedContract,
    }));
    const port = createLaceIdentityPort(options({ joinIdentity: joinIdentity as never }));

    await port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX);

    expect(joinIdentity).toHaveBeenCalledTimes(1);
    expect(joinIdentity.mock.calls[0]?.[1]).toBe(SYNTHETIC_IDENTITY_ADDRESS);
  });

  it("calls proveIdentity with the BUILD's issuer key, not the screen's", async () => {
    const callIdentity = vi.fn(
      async (_joined: unknown, _issuerKey: JubjubPoint, _expected: Uint8Array, _logger: unknown) => ({
        status: "ok",
        value: { matched: true, answered: 1n },
      }),
    );
    const port = createLaceIdentityPort(options({ callIdentity: callIdentity as never }));

    await port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX);

    expect(callIdentity.mock.calls[0]?.[1]).toEqual(BUILD_ISSUER_KEY);
    expect(callIdentity.mock.calls[0]?.[1]).not.toEqual(SCREEN_ISSUER_KEY);
  });

  it("passes the demo tax-ID hash through as the 32 bytes the circuit takes", async () => {
    const callIdentity = vi.fn(
      async (_joined: unknown, _issuerKey: JubjubPoint, _expected: Uint8Array, _logger: unknown) => ({
        status: "ok",
        value: { matched: true, answered: 1n },
      }),
    );
    const port = createLaceIdentityPort(options({ callIdentity: callIdentity as never }));

    await port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX);

    const expected = callIdentity.mock.calls[0]?.[2] as Uint8Array;
    expect(expected).toBeInstanceOf(Uint8Array);
    expect(expected.length).toBe(32);
    expect(Array.from(expected, (b) => b.toString(16).padStart(2, "0")).join("")).toBe(DEMO_TAX_ID_HEX);
  });

  it("reports a yes as a yes", async () => {
    const port = createLaceIdentityPort(options());
    await expect(port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX)).resolves.toEqual({
      status: "ok",
      value: true,
    });
  });

  // A predicate that does not hold is an answer, not a failure: it must come
  // back ok/false so the screen says "no", never "nobody could check".
  it("reports a no as a no, not as a degraded result", async () => {
    const port = createLaceIdentityPort(
      options({ callIdentity: (async () => ({ status: "ok", value: { matched: false, answered: 2n } })) as never }),
    );
    await expect(port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX)).resolves.toEqual({
      status: "ok",
      value: false,
    });
  });
});

describe("every failure is a typed degraded reason on this port's own step", () => {
  it("passes a preflight degrade straight through", async () => {
    const port = createLaceIdentityPort(options({ fetchImpl: proofServerDown }));
    await expect(port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "proof_server_unreachable" },
    });
  });

  it("re-steps a join that could not find the contract", async () => {
    const port = createLaceIdentityPort(
      options({
        joinIdentity: (async () => ({
          status: "degraded",
          degraded: { step: "join", reason: "contract_not_found" },
        })) as never,
      }),
    );
    await expect(port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "contract_not_found" },
    });
  });

  // An attestation the circuit rejects aborts the proof; it is never "she did
  // not match", and it arrives here as call_failed.
  it("re-steps a call that aborted", async () => {
    const port = createLaceIdentityPort(
      options({
        callIdentity: (async () => ({
          status: "degraded",
          degraded: { step: "call", reason: "call_failed" },
        })) as never,
      }),
    );
    await expect(port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "call_failed" },
    });
  });

  it("degrades call_failed on a tax-ID hash that is not 32 bytes of hex, without joining", async () => {
    const joinIdentity = vi.fn(async () => ({ status: "ok", value: joinedContract }));
    const port = createLaceIdentityPort(options({ joinIdentity: joinIdentity as never }));

    await expect(port.checkIdentity(SCREEN_ISSUER_KEY, "not-a-hash")).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "call_failed" },
    });
    expect(joinIdentity).not.toHaveBeenCalled();
  });

  it("never rejects when a layer below throws instead of degrading", async () => {
    const port = createLaceIdentityPort(
      options({
        joinIdentity: (async () => {
          throw new Error("the join broke its own never-throw contract");
        }) as never,
      }),
    );
    const result = await port.checkIdentity(SCREEN_ISSUER_KEY, DEMO_TAX_ID_HEX);
    expect(result).toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "call_failed" },
    });
  });

  it("never rejects when the connector itself is broken", async () => {
    const exploding = {
      mnLace: {
        rdns: "io.lace.midnight",
        name: "Exploding wallet",
        icon: "",
        apiVersion: "4.0.1",
        get connect(): never {
          throw new Error("the connector itself is broken");
        },
      },
    } as unknown as ConnectorHost;

    const result = await createLaceIdentityPort(options({ connectorHost: exploding })).checkIdentity(
      SCREEN_ISSUER_KEY,
      DEMO_TAX_ID_HEX,
    );
    expect(result.status).toBe("degraded");
    if (result.status === "degraded") expect(result.degraded.step).toBe("checkIdentity");
  });
});
