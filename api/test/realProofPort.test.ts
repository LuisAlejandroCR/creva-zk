// api/test/realProofPort.test.ts
// Checks the real backing port's wiring against fakes for the three external
// steps it drives: the local network, the deploy and the circuit call. What
// is proven here is the contract around the proof — one deployment reused,
// a degraded start not cached, the exclusive lock released, and never a
// throw — not the proof itself, which needs Docker and ~23.7s.

import { afterEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import {
  createRealBackingPort,
  shutdownRealPorts,
  TIER_PROVEN_BY_CLEARED_BACKING,
  type RealPortOptions,
} from "../src/realProofPort.js";
import type { LocalEnvironmentHandle } from "../src/localEnvironment.js";
import type { ApiResult } from "../src/types.js";

// Synthetic public arguments only.

const silent = pino({ level: "silent" });

function fakeEnvironment(shutdown = vi.fn(async () => undefined)): LocalEnvironmentHandle {
  return { configuration: {}, walletProvider: {}, shutdown } as unknown as LocalEnvironmentHandle;
}

interface Harness {
  readonly options: RealPortOptions;
  readonly startEnvironment: ReturnType<typeof vi.fn>;
  readonly buildProviders: ReturnType<typeof vi.fn>;
  readonly deploy: ReturnType<typeof vi.fn>;
  readonly call: ReturnType<typeof vi.fn>;
  readonly shutdown: ReturnType<typeof vi.fn>;
}

function harness(overrides: Partial<Record<"start" | "deploy" | "call", unknown>> = {}): Harness {
  const shutdown = vi.fn(async () => undefined);
  const environment = fakeEnvironment(shutdown);

  const startEnvironment = vi.fn(
    (overrides.start as (() => Promise<ApiResult<LocalEnvironmentHandle>>) | undefined) ??
      (async () => ({ status: "ok", value: environment }) as ApiResult<LocalEnvironmentHandle>),
  );
  const buildProviders = vi.fn(() => ({}) as never);
  const deploy = vi.fn(
    (overrides.deploy as (() => Promise<ApiResult<unknown>>) | undefined) ??
      (async () => ({ status: "ok", value: { callTx: {} } }) as ApiResult<unknown>),
  );
  const call = vi.fn(
    (overrides.call as (() => Promise<ApiResult<unknown>>) | undefined) ??
      (async () => ({ status: "ok", value: { cleared: true, answered: 1n } }) as ApiResult<unknown>),
  );

  return {
    startEnvironment,
    buildProviders,
    deploy,
    call,
    shutdown,
    options: {
      logger: silent,
      startEnvironment: startEnvironment as never,
      buildProviders: buildProviders as never,
      deploy: deploy as never,
      call: call as never,
    },
  };
}

// The deployment is module state by design, so every test starts from none.
afterEach(async () => {
  await shutdownRealPorts();
  vi.restoreAllMocks();
});

describe("createRealBackingPort", () => {
  it("deploys and calls the circuit, answering with a tier", async () => {
    const h = harness();
    const port = createRealBackingPort(silent, h.options);

    await expect(port.checkBacking(3_000n)).resolves.toEqual({
      status: "ok",
      value: TIER_PROVEN_BY_CLEARED_BACKING,
    });
    expect(h.startEnvironment).toHaveBeenCalledOnce();
    expect(h.deploy).toHaveBeenCalledOnce();
    expect(h.call).toHaveBeenCalledOnce();
  });

  it("passes the requested limit through to proveBacking as the public argument", async () => {
    const h = harness();
    await createRealBackingPort(silent, h.options).checkBacking(9_000n);
    expect(h.call.mock.calls[0]?.[1]).toBe(9_000n);
  });

  it("answers none when the collateral does not clear the limit", async () => {
    const h = harness({ call: async () => ({ status: "ok", value: { cleared: false, answered: 2n } }) });
    await expect(createRealBackingPort(silent, h.options).checkBacking(9_000n)).resolves.toEqual({
      status: "ok",
      value: "none",
    });
  });
});

describe("one deployment per process", () => {
  it("starts the network and deploys once across many calls", async () => {
    const h = harness();
    const port = createRealBackingPort(silent, h.options);

    await port.checkBacking(3_000n);
    await port.checkBacking(4_000n);
    await port.checkBacking(5_000n);

    expect(h.startEnvironment).toHaveBeenCalledOnce();
    expect(h.deploy).toHaveBeenCalledOnce();
    expect(h.call).toHaveBeenCalledTimes(3);
  });

  it("shares one in-flight deployment between concurrent calls", async () => {
    const h = harness();
    const port = createRealBackingPort(silent, h.options);

    await Promise.all([port.checkBacking(3_000n), port.checkBacking(3_000n), port.checkBacking(3_000n)]);

    expect(h.startEnvironment).toHaveBeenCalledOnce();
    expect(h.deploy).toHaveBeenCalledOnce();
  });

  it("shares the deployment between two ports built from the same options", async () => {
    const h = harness();
    await createRealBackingPort(silent, h.options).checkBacking(3_000n);
    await createRealBackingPort(silent, h.options).checkBacking(3_000n);
    expect(h.deploy).toHaveBeenCalledOnce();
  });
});

describe("degraded, never thrown", () => {
  it("passes a degraded environment start straight through", async () => {
    const h = harness({
      start: async () => ({ status: "degraded", degraded: { step: "start_network", reason: "environment_unavailable" } }),
    });
    await expect(createRealBackingPort(silent, h.options).checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "start_network", reason: "environment_unavailable" },
    });
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it("does not cache a degraded start, so a later call can pick Docker up", async () => {
    let attempt = 0;
    const h = harness({
      start: async () => {
        attempt += 1;
        return attempt === 1
          ? { status: "degraded", degraded: { step: "start_network", reason: "environment_unavailable" } }
          : { status: "ok", value: fakeEnvironment() };
      },
    });
    const port = createRealBackingPort(silent, h.options);

    expect((await port.checkBacking(3_000n)).status).toBe("degraded");
    expect((await port.checkBacking(3_000n)).status).toBe("ok");
    expect(h.startEnvironment).toHaveBeenCalledTimes(2);
  });

  it("releases the exclusive private-state lock when the deploy degrades", async () => {
    const h = harness({
      deploy: async () => ({ status: "degraded", degraded: { step: "deploy", reason: "deploy_failed" } }),
    });
    await expect(createRealBackingPort(silent, h.options).checkBacking(3_000n)).resolves.toMatchObject({
      status: "degraded",
    });
    expect(h.shutdown).toHaveBeenCalledOnce();
  });

  it("passes a degraded circuit call straight through, keeping the deployment", async () => {
    const h = harness({ call: async () => ({ status: "degraded", degraded: { step: "call", reason: "call_failed" } }) });
    const port = createRealBackingPort(silent, h.options);

    expect((await port.checkBacking(3_000n)).status).toBe("degraded");
    expect((await port.checkBacking(3_000n)).status).toBe("degraded");
    // The network stays up: a failed call is not a failed deployment.
    expect(h.startEnvironment).toHaveBeenCalledOnce();
  });

  it("degrades rather than throwing when a step breaks its own contract", async () => {
    const h = harness({
      start: async () => {
        throw new Error("docker exploded");
      },
    });
    await expect(createRealBackingPort(silent, h.options).checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "deploy", reason: "deploy_failed" },
    });
  });

  it("degrades rather than throwing when the circuit call itself throws", async () => {
    const h = harness({
      call: async () => {
        throw new Error("prover died");
      },
    });
    await expect(createRealBackingPort(silent, h.options).checkBacking(3_000n)).resolves.toEqual({
      status: "degraded",
      degraded: { step: "call", reason: "call_failed" },
    });
  });
});

describe("shutdownRealPorts", () => {
  it("releases the lock and lets the next call deploy again", async () => {
    const h = harness();
    const port = createRealBackingPort(silent, h.options);

    await port.checkBacking(3_000n);
    await shutdownRealPorts();
    expect(h.shutdown).toHaveBeenCalledOnce();

    await port.checkBacking(3_000n);
    expect(h.startEnvironment).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when nothing was ever deployed", async () => {
    await expect(shutdownRealPorts()).resolves.toBeUndefined();
  });
});
