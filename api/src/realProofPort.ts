// api/src/realProofPort.ts
// The real implementation of both proof ports. Deploy + call wiring (local
// environment, providers, proveBacking) is not finished here — that call
// path belongs to another agent — so this always returns a typed degraded
// result today, honestly and without throwing, until that wiring lands.

import { isContractCompiled } from "./contract.js";
import type { ApiDegraded, ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, Tier } from "./proofPort.js";

// The subset of pino's Logger this file needs. Kept local rather than
// importing pino's type so a browser caller (web/) never has to bundle
// pino just to select this port — it can pass console or a no-op instead.
export interface PortLogger {
  readonly info: (obj: Record<string, unknown>, msg: string) => void;
}

const noopLogger: PortLogger = { info: () => undefined };

function notWiredYet(step: string): ApiDegraded {
  return isContractCompiled() ? { step, reason: "call_failed" } : { step, reason: "contract_not_compiled" };
}

export function createRealBackingPort(logger: PortLogger = noopLogger): BackingProofPort {
  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      logger.info({ requestedLimit: requestedLimit.toString() }, "real backing port called before deploy/call wiring lands");
      return { status: "degraded", degraded: notWiredYet("checkBacking") };
    },
  };
}

export function createRealIdentityPort(logger: PortLogger = noopLogger): IdentityProofPort {
  return {
    async checkIdentity(requestedLimit: bigint): Promise<ApiResult<boolean>> {
      logger.info({ requestedLimit: requestedLimit.toString() }, "real identity port called before the identity circuit is wired");
      return { status: "degraded", degraded: { step: "checkIdentity", reason: "contract_not_compiled" } };
    },
  };
}
