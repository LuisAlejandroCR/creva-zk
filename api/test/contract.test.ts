// api/test/contract.test.ts
// Checks the never-throw contract of the deploy/call wrappers and that the ZK
// config path points at the compiler's output. Requires `npm run compact:build`
// to have run — the compiled circuit is a build artifact, not an external
// service, so a missing one is a build error rather than a degraded result.

import { describe, expect, it } from "vitest";
import pino from "pino";
import { callProveBacking, deployBacking, zkConfigPath, type BackingProviders } from "../src/contract.js";
import type { DeployedBacking } from "../src/contract.js";

const logger = pino({ enabled: false });

describe("zkConfigPath", () => {
  it("points at the compiler's output directory for the backing circuit", () => {
    expect(zkConfigPath().replace(/\\/g, "/")).toMatch(/contract\/src\/managed\/backing$/);
  });
});

describe("deployBacking", () => {
  it("degrades instead of throwing when the providers are unusable", async () => {
    // Stands in for "everything external is down": the providers object has
    // none of the methods deployContract reaches for.
    const providers = {} as BackingProviders;

    const result = await deployBacking(providers, 5_000n, logger);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toBe("deploy_failed");
      expect(result.degraded.step).toBe("deploy");
    }
  });
});

describe("callProveBacking", () => {
  it("degrades instead of throwing when the call transaction fails", async () => {
    const deployed = {
      callTx: {
        proveBacking: () => Promise.reject(new Error("proof server unreachable")),
      },
    } as unknown as DeployedBacking;

    const result = await callProveBacking(deployed, 3_000n, logger);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toBe("call_failed");
      expect(result.degraded.step).toBe("call");
    }
  });
});
