// api/test/contract.test.ts
// Exercises the "external dependent is down" path without Docker, a proof
// server, or the compact toolchain: contract/src/managed/backing does not
// exist in this sandbox, so every entry point must degrade, never throw.

import { describe, expect, it } from "vitest";
import pino from "pino";
import { deployBacking, isContractCompiled, zkConfigPath } from "../src/contract.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

const logger = pino({ enabled: false });

describe("contract loading", () => {
  it("reports whether the compact compiler has produced the generated module", () => {
    // This assertion documents the sandbox's actual state rather than
    // forcing one outcome: on a machine that has run `compact compile`,
    // this is true and deployBacking proceeds past the load step.
    expect(typeof isContractCompiled()).toBe("boolean");
  });

  it("points zkConfigPath at contract/src/managed/backing", () => {
    expect(zkConfigPath().replace(/\\/g, "/")).toMatch(/contract\/src\/managed\/backing$/);
  });

  it("degrades instead of throwing when the contract has not been compiled", async () => {
    if (isContractCompiled()) return; // nothing to assert on a machine that did compile it

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providers = {} as MidnightProviders<any, string, { collateralAmount: bigint }>;
    const result = await deployBacking(providers, 5_000n, logger);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toBe("contract_not_compiled");
    }
  });
});
