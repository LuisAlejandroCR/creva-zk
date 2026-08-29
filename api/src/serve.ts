#!/usr/bin/env node
// api/src/serve.ts
// The one command that puts a live proof behind an HTTP endpoint the browser
// can reach: `npm run serve --workspace api`. This process, and only this
// process, may run at a time — it owns the private-state LevelDB, whose lock
// is exclusive, so the demo runner must not be running alongside it. The
// first request pays ~19s to start the network and deploy; every request
// after it pays only the ~23.7s proof, against that one deployment.

import pino from "pino";
import { createRealBackingPort, createRealIdentityPort, shutdownRealPorts } from "./realProofPort.js";
import { DEFAULT_PROOF_SERVER_PORT, startProofServer, type ProofPorts } from "./proofServer.js";

const logger = pino({ transport: { target: "pino-pretty" } });

function resolvePort(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : DEFAULT_PROOF_SERVER_PORT;
}

// The real ports are what the browser is reaching for. Backing runs the
// circuit; identity still degrades, and the screens are built to render
// that. Nothing is deployed until the first request arrives, so the server
// binds its port immediately rather than after a cold start.
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

// Stop accepting requests first, then tear the deployment down so the
// exclusive private-state lock is released for the next process. Both steps
// are best-effort: a signal handler that throws takes the exit code with it.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void started.value
      .close()
      .catch(() => undefined)
      .then(() => shutdownRealPorts())
      .catch(() => undefined)
      .then(() => process.exit(0));
  });
}
