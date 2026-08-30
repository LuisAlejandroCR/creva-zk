#!/usr/bin/env node
// api/src/runIdentity.ts
// Measures what a signed-attestation proof actually costs. Deploys
// identity-check.compact, calls proveIdentity twice — once against the
// issuer that signed the deployment's attestation, once against a stranger
// — and prints the wall-clock latency of each call.
//
// This is the number `tools/PROOF-LATENCY.md` declares as unmeasured: the
// ~23.7 s figure was taken on backing.compact, which verifies no signature.
// Run with `npm run demo:identity --workspace api` on a machine with Docker
// and the Compact toolchain.
//
// The claim below is synthetic demo data; no value belongs to a real person.

import pino from "pino";
import { createRealIdentityPort, realIdentityIssuerKey, DEFAULT_TAX_ID_HEX } from "./realIdentityPort.js";
import { shutdownIdentityPort } from "./realIdentityPort.js";
import { shutdownSharedEnvironment } from "./sharedEnvironment.js";
import type { JubjubPoint } from "./proofPort.js";

const logger = pino({ transport: { target: "pino-pretty" } });

// A point nobody holds a secret for. Proving against it must ABORT inside
// verifyAttestation, not answer false — that distinction is the whole
// reason this second call is measured at all.
const STRANGER_KEY: JubjubPoint = { x: 3n, y: 5n };

// Fixed so a repeat run names the same issuer and the numbers compare.
const ISSUER_SECRET_KEY = 987_654_321n;

async function main(): Promise<void> {
  const options = { issuerSecretKey: ISSUER_SECRET_KEY, logger } as const;
  const port = createRealIdentityPort(logger, options);

  // The first call pays for the network start and the deploy as well, so it
  // is timed separately and never reported as proof latency.
  const openedAt = Date.now();
  const issuer = await realIdentityIssuerKey(logger, options);
  const setupMs = Date.now() - openedAt;
  if (issuer.status === "degraded") {
    logger.error({ degraded: issuer.degraded, setupMs }, "identity deployment degraded — nothing to measure");
    process.exitCode = 1;
    return;
  }
  logger.info({ setupMs }, "network start + deploy");

  const matchStart = Date.now();
  const matched = await port.checkIdentity(issuer.value, DEFAULT_TAX_ID_HEX);
  const matchMs = Date.now() - matchStart;
  logger.info({ ms: matchMs, result: matched }, "proveIdentity — issuer known, tax id matches");

  const strangerStart = Date.now();
  const stranger = await port.checkIdentity(STRANGER_KEY, DEFAULT_TAX_ID_HEX);
  const strangerMs = Date.now() - strangerStart;
  logger.info({ ms: strangerMs, result: stranger }, "proveIdentity — issuer unknown, must degrade not answer false");

  logger.info(
    { setupMs, matchMs, strangerMs },
    "SUMMARY — setup, known issuer, unknown issuer, all in milliseconds",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, "identity measurement threw");
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownIdentityPort();
    await shutdownSharedEnvironment();
  });
