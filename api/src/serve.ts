#!/usr/bin/env node
// api/src/serve.ts
// The one command that puts a live proof behind an HTTP endpoint the browser
// can reach: `npm run serve --workspace api`. This process, and only this
// process, may run at a time — it owns the private-state LevelDB, whose lock
// is exclusive, so the demo runner must not be running alongside it.

import pino from "pino";
import { createRealBackingPort, createRealIdentityPort } from "./realProofPort.js";
import { DEFAULT_PROOF_SERVER_PORT, startProofServer, type ProofPorts } from "./proofServer.js";

const logger = pino({ transport: { target: "pino-pretty" } });

function resolvePort(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : DEFAULT_PROOF_SERVER_PORT;
}

// The real ports are what the browser is reaching for; they return a typed
// degraded result until their deploy/call wiring lands, which is exactly what
// the bridge and the screens are built to render.
const ports: ProofPorts = {
  backing: createRealBackingPort(logger),
  identity: createRealIdentityPort(logger),
};

const started = await startProofServer(ports, resolvePort(process.env["PROOF_SERVER_PORT"]), logger);

if (started.status === "degraded") {
  logger.error({ degraded: started.degraded }, "proof server did not start");
  // Explicit exit for the same reason run.ts uses one: pino-pretty's worker
  // thread can exit before process.exitCode takes effect.
  process.exit(1);
}

logger.info({ port: started.value.port }, "proof server listening — set VITE_PORT_SOURCE=bridge in web/");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void started.value.close().then(() => process.exit(0));
  });
}
