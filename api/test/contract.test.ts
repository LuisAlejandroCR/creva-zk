// api/test/contract.test.ts
// Checks the never-throw contract of the deploy, join and call wrappers.
// Requires `npm run compact:build` to have run — the compiled circuit is a
// build artifact, not an external service, so a missing one is a build error
// rather than a degraded result. The ZK config path is checked separately,
// in zkConfigPath.test.ts, because that one needs no compiled circuit.

import { describe, expect, it } from "vitest";
import pino from "pino";
import { callProveBacking, deployBacking, joinBacking, type BackingProviders } from "../src/contract.js";
import type { FoundBacking } from "../src/contract.js";

const logger = pino({ enabled: false });

// A contract address is 64 hex characters with no 0x prefix — see
// assertIsContractAddress in @midnight-ntwrk/midnight-js-utils. Synthetic.
const SYNTHETIC_CONTRACT_ADDRESS = "ab".repeat(32);

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
    } as unknown as FoundBacking;

    const result = await callProveBacking(deployed, 3_000n, logger);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toBe("call_failed");
      expect(result.degraded.step).toBe("call");
    }
  });
});

describe("joinBacking", () => {
  it("degrades contract_not_found when the address is not an address", async () => {
    const result = await joinBacking({} as BackingProviders, "not-an-address", 5_000n, logger);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toBe("contract_not_found");
      expect(result.degraded.step).toBe("join");
    }
  });

  it("degrades instead of throwing when the providers are unusable", async () => {
    // Stands in for "everything external is down": the providers object has
    // none of the methods findDeployedContract reaches for.
    const result = await joinBacking({} as BackingProviders, SYNTHETIC_CONTRACT_ADDRESS, 5_000n, logger);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toBe("contract_not_found");
    }
  });
});
