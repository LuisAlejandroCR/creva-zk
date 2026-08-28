#!/usr/bin/env node
// api/src/run.ts
// The single unattended entry point: start the local network, deploy the
// backing circuit, call proveBacking once with collateral that clears the
// requested limit and once with collateral that doesn't, and print the
// measured proof latency for each call in milliseconds. Run with
// `npm run demo --workspace api` on a machine with Docker and the compact
// toolchain — this cannot run in a sandbox with neither.
//
// All amounts below are synthetic demo data; none belongs to a real
// account or a real applicant.

import pino from "pino";
import { startLocalEnvironment } from "./localEnvironment.js";
import { createProviders } from "./providers.js";
import { deployBacking, callProveBacking, zkConfigPath, type BackingPrivateState } from "./contract.js";
import { measureMs, measureCircuitCall } from "./measure.js";
import type { BackingCheck, BackingCheckOutcome, DemoReport } from "./types.js";

const logger = pino({ transport: { target: "pino-pretty" } });

// Reference measurement from example-bboard on the target machine: one
// circuit call landed under 48.4s (an upper bound that includes a
// keystroke). If a call here comes in near 90s, the two-minute demo video
// is not filmable as designed — flag it loudly rather than let the number
// pass quietly in a JSON blob.
const LATENCY_WARN_THRESHOLD_MS = 70_000;

// Synthetic demo data: no real applicant, no real balance.
const CHECKS: readonly BackingCheck[] = [
  {
    label: "synthetic: collateral clears the requested limit",
    collateralAmount: 5_000n,
    requestedLimit: 3_000n,
    expectCleared: true,
  },
  {
    label: "synthetic: collateral does not clear the requested limit",
    collateralAmount: 1_000n,
    requestedLimit: 3_000n,
    expectCleared: false,
  },
];

async function run(): Promise<DemoReport> {
  const { value: startResult, ms: coldStartMs } = await measureMs(() => startLocalEnvironment(logger));

  if (startResult.status === "degraded") {
    return startResult;
  }
  const env = startResult.value;

  try {
    const outcomes: BackingCheckOutcome[] = [];
    let deployMs = 0;

    // Each check deploys its own contract instance so the second call is
    // never measuring a warmed-up prover from the first — every call in
    // `outcomes` is a cold `proveBacking` invocation.
    for (const check of CHECKS) {
      const providers = createProviders<string, BackingPrivateState>(
        env.configuration,
        env.walletProvider,
        zkConfigPath(),
      );

      const deployStart = await measureMs(() => deployBacking(providers, check.collateralAmount, logger));
      if (deployStart.value.status === "degraded") return deployStart.value;
      deployMs = deployStart.ms;
      const deployed = deployStart.value.value;

      // THE MEASUREMENT THAT MATTERS: the timer wraps only this call, with
      // nothing else — no human input, no unrelated await — between marks.
      const { value: callResult, latency } = await measureCircuitCall("proveBacking", () =>
        callProveBacking(deployed, check.requestedLimit, logger),
      );
      if (callResult.status === "degraded") return callResult;

      const outcome = callResult.value;
      if (outcome.cleared !== check.expectCleared) {
        logger.error(
          { check: check.label, expected: check.expectCleared, actual: outcome.cleared },
          "public ledger did not change as expected",
        );
        return { status: "degraded", degraded: { step: "assert", reason: "call_failed" } };
      }

      outcomes.push({ check, cleared: outcome.cleared, answered: outcome.answered, latency });
      logger.info({ check: check.label, ms: latency.ms.toFixed(1) }, "proveBacking call measured");
    }

    return { status: "ok", environmentColdStartMs: coldStartMs, deployMs, outcomes };
  } finally {
    await env.shutdown();
  }
}

// A throw anywhere in run() is still a degraded result, never an escaping
// exception: an unhandled rejection here would skip the exit-code handling
// below and could let a broken run turn a CI gate green.
const report: DemoReport = await run().catch((error: unknown) => {
  logger.error({ err: error }, "demo threw instead of degrading");
  return { status: "degraded", degraded: { step: "run", reason: "call_failed" } } as const;
});

if (report.status === "degraded") {
  logger.error({ degraded: report.degraded }, "demo did not complete");
  process.stdout.write(`${JSON.stringify(report, jsonReplacer, 2)}\n`);
  // Explicit exit, not `process.exitCode`: pino's pino-pretty transport runs
  // in a worker thread whose own exit can land before the assignment takes
  // effect, which is how a broken run was exiting 0.
  process.exit(1);
} else {
  const upperBoundMs = Math.max(...report.outcomes.map((o) => o.latency.ms));
  logger.info(
    {
      environmentColdStartMs: report.environmentColdStartMs.toFixed(1),
      deployMs: report.deployMs.toFixed(1),
      circuitCallsMs: report.outcomes.map((o) => `${o.check.label}: ${o.latency.ms.toFixed(1)}ms`),
      upperBoundMs: upperBoundMs.toFixed(1),
    },
    "demo complete",
  );
  if (upperBoundMs >= LATENCY_WARN_THRESHOLD_MS) {
    logger.warn(
      { upperBoundMs: upperBoundMs.toFixed(1), referenceUpperBoundMs: 48_400 },
      "proveBacking latency is close to 90s — the two-minute demo video is not filmable as designed; revisit the plan today",
    );
  }
  process.stdout.write(`${JSON.stringify(report, jsonReplacer, 2)}\n`);
  process.exit(0);
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
