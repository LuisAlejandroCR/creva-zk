// api/src/laceProofPort.ts
// The browser-direct implementation of both proof ports: the browser talks
// to Midnight itself, with Lace as the wallet and no Node process in
// between. Each call runs a preflight that can fail four distinguishable
// ways — wallet absent, wallet locked, wrong network, local proof server
// unreachable — and only then builds the six providers in the page. The
// deploy/call step on top of that stack is still the real port's unfinished
// wiring, so a fully-preflighted call degrades honestly rather than lying.

import type { ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";
import type { PortLogger } from "./realProofPort.js";
import { connectLaceWallet, degraded, type LaceConnection, type LaceWalletOptions } from "./laceWallet.js";
import { createLaceProviders, type LaceProviderOptions } from "./laceProviders.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

// The address Lace's own "Settings » Midnight » Local" proof server listens
// on. Used only when the wallet does not report one of its own, so a user
// who pointed Lace somewhere else is still proved against their choice.
export const DEFAULT_LOCAL_PROOF_SERVER_URL = "http://localhost:6300";

// A reachability probe, not a proof: this is bounded far below the ~23.7s a
// real proof costs, because a server that is not listening should fail the
// screen immediately rather than after half a minute of nothing.
export const DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS = 3_000;

export interface LaceOptions extends LaceWalletOptions, Partial<Omit<LaceProviderOptions, "proofServerUrl">> {
  /** Overrides the proof server the wallet reports; normally left unset. */
  readonly proofServerUrl?: string;
  readonly proofServerProbeTimeoutMs?: number;
  readonly logger?: PortLogger;
}

const noopLogger: PortLogger = { info: () => undefined };

export interface LaceStack<CircuitId extends string, PrivateStateId extends string, PrivateState> {
  readonly connection: LaceConnection;
  readonly proofServerUrl: string;
  readonly providers: MidnightProviders<CircuitId, PrivateStateId, PrivateState>;
}

// Any HTTP answer at all — 200, 404, 405 — proves something is listening,
// so this deliberately does not depend on the proof server exposing a
// particular health route. `no-cors` keeps a missing CORS header from
// reading as "down": an opaque response still resolves, while a refused
// connection or the timeout above still rejects.
export async function probeProofServer(url: string, doFetch: typeof fetch, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await doFetch(url, { method: "GET", mode: "no-cors", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Wallet, then network, then proof server, then providers — in that order,
// so the reason that comes back names the first thing the user has to fix.
export async function prepareLaceStack<CircuitId extends string, PrivateStateId extends string, PrivateState>(
  step: string,
  options: LaceOptions = {},
): Promise<ApiResult<LaceStack<CircuitId, PrivateStateId, PrivateState>>> {
  const connectionResult = await connectLaceWallet(step, options);
  if (connectionResult.status === "degraded") {
    return connectionResult;
  }
  const connection = connectionResult.value;

  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (doFetch === undefined) {
    return degraded(step, "environment_unavailable");
  }

  const proofServerUrl =
    options.proofServerUrl ?? connection.configuration.proverServerUri ?? DEFAULT_LOCAL_PROOF_SERVER_URL;

  const reachable = await probeProofServer(
    proofServerUrl,
    doFetch,
    options.proofServerProbeTimeoutMs ?? DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS,
  );
  if (!reachable) {
    return degraded(step, "proof_server_unreachable");
  }

  const providersResult = await createLaceProviders<CircuitId, PrivateStateId, PrivateState>(step, connection, {
    ...options,
    fetchImpl: doFetch,
    proofServerUrl,
  });
  if (providersResult.status === "degraded") {
    return providersResult;
  }

  return { status: "ok", value: { connection, proofServerUrl, providers: providersResult.value } };
}

export function createLaceBackingPort(options: LaceOptions = {}): BackingProofPort {
  const logger = options.logger ?? noopLogger;
  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      const stack = await prepareLaceStack("checkBacking", options);
      if (stack.status === "degraded") {
        logger.info({ reason: stack.degraded.reason }, "lace backing port preflight degraded");
        return stack;
      }
      logger.info(
        { requestedLimit: requestedLimit.toString(), proofServerUrl: stack.value.proofServerUrl },
        "lace backing port reached a complete browser provider stack before deploy/call wiring lands",
      );
      return degraded("checkBacking", "call_failed");
    },
  };
}

export function createLaceIdentityPort(options: LaceOptions = {}): IdentityProofPort {
  const logger = options.logger ?? noopLogger;
  return {
    async checkIdentity(issuerKey: JubjubPoint, expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      const stack = await prepareLaceStack("checkIdentity", options);
      if (stack.status === "degraded") {
        logger.info({ reason: stack.degraded.reason }, "lace identity port preflight degraded");
        return stack;
      }
      logger.info(
        { issuerKey: issuerKey.compressed, expectedTaxIdHash, proofServerUrl: stack.value.proofServerUrl },
        "lace identity port reached a complete browser provider stack before the identity circuit is wired",
      );
      return degraded("checkIdentity", "call_failed");
    },
  };
}
