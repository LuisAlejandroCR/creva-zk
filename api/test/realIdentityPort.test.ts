// api/test/realIdentityPort.test.ts
// Checks the real identity port's wiring against fakes for the network, the
// deploy and the circuit call: one deployment reused, a degraded attempt not
// cached, a malformed tax-ID hash refused, and never a throw.

import { afterEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import {
  createRealIdentityPort,
  realIdentityIssuerKey,
  shutdownIdentityPort,
  DEFAULT_TAX_ID_HEX,
  type RealIdentityPortOptions,
} from "../src/realIdentityPort.js";
import { shutdownSharedEnvironment } from "../src/sharedEnvironment.js";
import type { LocalEnvironmentHandle } from "../src/localEnvironment.js";
import type { ApiResult } from "../src/types.js";
import type { JubjubPoint } from "../src/proofPort.js";

const silent = pino({ level: "silent" });

// Synthetic public arguments only. Neither key belongs to anyone.
const OTHER_ISSUER_KEY: JubjubPoint = { x: 7n, y: 9n };

function fakeEnvironment(shutdown = vi.fn(async () => undefined)): LocalEnvironmentHandle {
  return { configuration: {}, walletProvider: {}, shutdown } as unknown as LocalEnvironmentHandle;
}

interface Harness {
  readonly options: RealIdentityPortOptions;
  readonly startEnvironment: ReturnType<typeof vi.fn>;
  readonly deploy: ReturnType<typeof vi.fn>;
  readonly call: ReturnType<typeof vi.fn>;
}

function harness(overrides: Partial<{ start: unknown; deploy: unknown; call: unknown }> = {}): Harness {
  const startEnvironment = vi.fn(
    async (): Promise<ApiResult<LocalEnvironmentHandle>> =>
      (overrides.start as ApiResult<LocalEnvironmentHandle>) ?? { status: "ok", value: fakeEnvironment() },
  );
  const deploy = vi.fn(
    async () => (overrides.deploy as ApiResult<unknown>) ?? { status: "ok", value: { callTx: {} } },
  );
  const call = vi.fn(
    async () => (overrides.call as ApiResult<unknown>) ?? { status: "ok", value: { matched: true, answered: 1n } },
  );

  return {
    startEnvironment,
    deploy,
    call,
    options: {
      startEnvironment: startEnvironment as never,
      buildProviders: (() => ({})) as never,
      deploy: deploy as never,
      call: call as never,
      // Fixed so the issuer key is the same on every run of this file.
      issuerSecretKey: 12_345n,
    },
  };
}

afterEach(async () => {
  await shutdownIdentityPort();
  await shutdownSharedEnvironment();
  vi.restoreAllMocks();
});

describe("createRealIdentityPort", () => {
  it("answers with what the circuit returned", async () => {
    const h = harness();
    const port = createRealIdentityPort(silent, h.options);

    await expect(port.checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX)).resolves.toEqual({
      status: "ok",
      value: true,
    });
    expect(h.call).toHaveBeenCalledTimes(1);
  });

  it("deploys once and reuses it, because the deploy costs ~19s", async () => {
    const h = harness();
    const port = createRealIdentityPort(silent, h.options);

    await port.checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX);
    await port.checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX);

    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(h.call).toHaveBeenCalledTimes(2);
  });

  it("passes the tax-ID hash as the 32 bytes the circuit takes", async () => {
    const h = harness();
    await createRealIdentityPort(silent, h.options).checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX);

    const expected = h.call.mock.calls[0]?.[2] as Uint8Array;
    expect(expected).toBeInstanceOf(Uint8Array);
    expect(expected.length).toBe(32);
  });

  it("refuses a tax-ID hash that is not 32 bytes of hex, rather than padding it", async () => {
    const h = harness();

    await expect(createRealIdentityPort(silent, h.options).checkIdentity(OTHER_ISSUER_KEY, "c4e7")).resolves.toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "call_failed" },
    });
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it("does not cache a degraded start, so a later Docker recovers", async () => {
    const h = harness({ start: { status: "degraded", degraded: { step: "environment", reason: "environment_unavailable" } } });
    const port = createRealIdentityPort(silent, h.options);

    await port.checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX);
    await port.checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX);

    expect(h.startEnvironment).toHaveBeenCalledTimes(2);
  });

  it("degrades rather than throwing when the call throws", async () => {
    const h = harness();
    h.call.mockRejectedValue(new Error("prover exploded"));

    await expect(createRealIdentityPort(silent, h.options).checkIdentity(OTHER_ISSUER_KEY, DEFAULT_TAX_ID_HEX)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "call", reason: "call_failed" },
    });
  });

  it("names the issuer its own deployment was signed by", async () => {
    const h = harness();
    const key = await realIdentityIssuerKey(silent, h.options);

    expect(key.status).toBe("ok");
    if (key.status !== "ok") return;
    // A point, not a hex string: the circuit takes (x, y).
    expect(typeof key.value.x).toBe("bigint");
    expect(typeof key.value.y).toBe("bigint");
  });
});
