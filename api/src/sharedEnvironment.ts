// api/src/sharedEnvironment.ts
// One local Midnight network per process, shared by every real port.
//
// Not an optimisation: the private-state LevelDB lock is exclusive, so a
// second environment in the same process would fail to open it. Starting it
// also costs ~52s, which no port should pay twice.
//
// A degraded start is deliberately not memoised, so a long-lived server can
// recover once Docker is actually up.

import type { Logger } from "pino";
import type { ApiResult } from "./types.js";
import { startLocalEnvironment, type LocalEnvironmentHandle } from "./localEnvironment.js";

export type StartEnvironment = typeof startLocalEnvironment;

let environmentPromise: Promise<ApiResult<LocalEnvironmentHandle>> | undefined;

// Every concurrent caller shares one in-flight attempt, so two requests
// arriving together never start two networks.
export function sharedEnvironment(
  logger: Logger,
  start: StartEnvironment = startLocalEnvironment,
): Promise<ApiResult<LocalEnvironmentHandle>> {
  if (environmentPromise === undefined) {
    const attempt = start(logger).then((result) => {
      if (result.status === "degraded" && environmentPromise === attempt) {
        environmentPromise = undefined;
      }
      return result;
    });
    environmentPromise = attempt;
  }
  return environmentPromise;
}

// Shuts the shared environment down and releases the private-state lock.
// Best-effort and never throws: it runs on a signal handler, where a throw
// would take the exit code with it.
export async function shutdownSharedEnvironment(): Promise<void> {
  const pending = environmentPromise;
  environmentPromise = undefined;
  if (pending === undefined) return;

  const settled = await pending.catch(() => undefined);
  if (settled !== undefined && settled.status === "ok") {
    await settled.value.shutdown().catch(() => undefined);
  }
}

// Drops the memo without shutting anything down. For tests that hand in a
// fake start and must not inherit the previous one's environment.
export function resetSharedEnvironment(): void {
  environmentPromise = undefined;
}
