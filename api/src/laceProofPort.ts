// api/src/laceProofPort.ts
// The browser-direct implementation of both proof ports: the browser talks
// to Midnight itself, with Lace as the wallet and no Node process in
// between. Each call runs a preflight that can fail five distinguishable
// ways — wallet absent, wallet locked, wrong network, local proof server
// unreachable, contract not found — builds the six providers in the page,
// and then JOINS the backing contract rather than deploying one.
//
// JOIN, NEVER DEPLOY. Deploying from the browser would cost the ~19s the
// Node path pays and would ask her to sign a deployment that is not hers.
// The contract is deployed once from the CLI (`npm run demo --workspace
// api`), its address is handed to the build as VITE_BACKING_CONTRACT_ADDRESS,
// and her wallet then signs only her own proof: ~24s instead of ~43s.
//
// The compiled circuit is imported lazily, on the first call, for the same
// reason realProofPort.ts does it: importing it at module scope would make
// this file unloadable wherever `npm run compact:build` has not run, and it
// is what carries Midnight's WebAssembly into the lace chunk.

import type { ApiDegraded, ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";
import type { PortLogger } from "./portLogger.js";
import { connectLaceWallet, degraded, type LaceConnection, type LaceWalletOptions } from "./laceWallet.js";
import { createLaceProviders, type LaceProviderOptions } from "./laceProviders.js";
import { DEFAULT_COLLATERAL_AMOUNT, TIER_PROVEN_BY_CLEARED_BACKING } from "./backingClaim.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

// Type-only, so nothing here loads the compiled contract at module scope.
// Every shape below is read off that module rather than restated, so the two
// cannot drift apart.
type ContractModule = typeof import("./contract.js");
type BackingProviders = Parameters<ContractModule["joinBacking"]>[0];
type JoinBacking = ContractModule["joinBacking"];
type CallProveBacking = ContractModule["callProveBacking"];
type CircuitId = ContractModule["BACKING_CIRCUIT_ID"];
type PrivateStateId = ContractModule["BACKING_PRIVATE_STATE_ID"];
type BackingPrivateState = ReturnType<ContractModule["createBackingPrivateState"]>;

// The address Lace's own "Settings » Midnight » Local" proof server listens
// on. Used only when the wallet does not report one of its own, so a user
// who pointed Lace somewhere else is still proved against their choice.
export const DEFAULT_LOCAL_PROOF_SERVER_URL = "http://localhost:6300";

// A reachability probe, not a proof: this is bounded far below the ~23.7s a
// real proof costs, because a server that is not listening should fail the
// screen immediately rather than after half a minute of nothing.
export const DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS = 3_000;

// The content type httpClientProofProvider posts /check and /prove with
// (see its dist/index.mjs: makeHttpRequest sets it on every request). It is
// not a CORS-safelisted value, so sending it makes the browser preflight —
// which is the whole point of the probe below.
export const PROOF_REQUEST_CONTENT_TYPE = "application/octet-stream";

export interface LaceOptions extends LaceWalletOptions, Partial<Omit<LaceProviderOptions, "proofServerUrl">> {
  /** Overrides the proof server the wallet reports; normally left unset. */
  readonly proofServerUrl?: string;
  readonly proofServerProbeTimeoutMs?: number;
  /**
   * Hex address of the backing contract, deployed once from the CLI. Without
   * it this path has nothing to join, which is contract_not_found — it never
   * falls back to deploying one from the browser.
   */
  readonly contractAddress?: string;
  /** The collateral this browser holds as witness-only private state. */
  readonly collateralAmount?: bigint;
  /** How long to wait for the indexer to confirm the deployment. */
  readonly joinTimeoutMs?: number;
  readonly logger?: PortLogger;
  // Test seams. Both default to the real thing; they exist so the join,
  // degrade and never-throw contracts can be exercised without a browser, a
  // wallet, a proof server or the compiled circuit.
  readonly join?: JoinBacking;
  readonly call?: CallProveBacking;
}

const noopLogger: PortLogger = { info: () => undefined };

export interface LaceStack<CircuitId extends string, PrivateStateId extends string, PrivateState> {
  readonly connection: LaceConnection;
  readonly proofServerUrl: string;
  readonly providers: MidnightProviders<CircuitId, PrivateStateId, PrivateState>;
}

// A REAL cross-origin request, deliberately. An earlier version used
// `mode: 'no-cors'`, which resolves opaquely: a proof server that is
// listening but sends no CORS headers passed the probe and then failed
// ~20s later inside the prover, blamed on the wrong thing. This sends the
// same Content-Type the prover will, which is not CORS-safelisted, so the
// browser preflights exactly as it will for /check and /prove. Any answer
// this page can read — 200, 404, 405 — proves both "listening" and "will
// let this origin read it". A refused connection, a rejected preflight and
// the timeout all reject, and the reason is logged rather than swallowed.
export async function probeProofServer(
  url: string,
  doFetch: typeof fetch,
  timeoutMs: number,
  logger: PortLogger = noopLogger,
): Promise<boolean> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await doFetch(url, {
      method: "GET",
      headers: { "Content-Type": PROOF_REQUEST_CONTENT_TYPE },
      signal: controller.signal,
    });
    logger.info({ proofServerUrl: url, status: response.status }, "local proof server answered the probe");
    return true;
  } catch (error) {
    // A CORS rejection and a dead port are the same TypeError to a page, so
    // the error itself is the only thing that tells them apart. It goes to
    // the log, never into the degraded reason.
    logger.error?.({ err: error, proofServerUrl: url }, "local proof server probe failed");
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
  const logger = options.logger ?? noopLogger;
  const connectionResult = await connectLaceWallet(step, { ...options, logger });
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
    logger,
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

// Loaded on the first call, not at module scope. A build without the
// compiled circuit gets a typed degraded result here rather than an import
// error the moment the chunk is fetched.
async function loadContract(logger: PortLogger): Promise<ApiResult<ContractModule>> {
  try {
    return { status: "ok", value: await import("./contract.js") };
  } catch (error) {
    logger.error?.({ err: error }, "compiled backing contract is missing — run npm run compact:build");
    return { status: "degraded", degraded: { step: "join", reason: "contract_not_compiled" } };
  }
}

// Everything after the preflight: join the contract the build named, call
// proveBacking, and report the strongest tier that proof supports. Every
// degraded result is re-stamped with this port's own step, so the screen
// always sees "checkBacking" no matter which layer gave up.
async function proveBacking(
  step: string,
  requestedLimit: bigint,
  options: LaceOptions,
  providers: BackingProviders,
  logger: PortLogger,
): Promise<ApiResult<Tier>> {
  const contractAddress = options.contractAddress?.trim();
  if (contractAddress === undefined || contractAddress === "") {
    // A build that names no address cannot join anything, and this path
    // never deploys instead: that would cost her ~19s and a signature on
    // somebody else's deployment. See this file's header.
    logger.error?.({}, "no backing contract address — set VITE_BACKING_CONTRACT_ADDRESS to the CLI's deployment");
    return degraded(step, "contract_not_found");
  }

  let join = options.join;
  let call = options.call;
  if (join === undefined || call === undefined) {
    const loaded = await loadContract(logger);
    if (loaded.status === "degraded") return restep(step, loaded);
    join ??= loaded.value.joinBacking;
    call ??= loaded.value.callProveBacking;
  }

  const joined = await join(
    providers,
    contractAddress,
    options.collateralAmount ?? DEFAULT_COLLATERAL_AMOUNT,
    logger,
    options.joinTimeoutMs,
  );
  if (joined.status === "degraded") return restep(step, joined);

  // ~23.7s, measured. Nothing but the circuit call sits between here and the
  // result: the deployment was paid for once, from the CLI, by somebody else.
  const outcome = await call(joined.value, requestedLimit, logger);
  if (outcome.status === "degraded") return restep(step, outcome);

  logger.info(
    {
      requestedLimit: requestedLimit.toString(),
      cleared: outcome.value.cleared,
      answered: outcome.value.answered.toString(),
    },
    "proveBacking answered in the browser",
  );
  return { status: "ok", value: outcome.value.cleared ? TIER_PROVEN_BY_CLEARED_BACKING : "none" };
}

// The layers below name their own step ("join", "call"); the port's contract
// with the screens is that the step is the port's. The reason travels
// untouched — that is the part the user reads.
function restep<T>(step: string, result: { readonly degraded: ApiDegraded }): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason: result.degraded.reason } };
}

export function createLaceBackingPort(options: LaceOptions = {}): BackingProofPort {
  const logger = options.logger ?? noopLogger;
  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      const stack = await prepareLaceStack<CircuitId, PrivateStateId, BackingPrivateState>("checkBacking", options);
      if (stack.status === "degraded") {
        logger.info({ reason: stack.degraded.reason }, "lace backing port preflight degraded");
        return stack;
      }
      try {
        return await proveBacking("checkBacking", requestedLimit, options, stack.value.providers, logger);
      } catch (error) {
        // contract.ts degrades rather than throwing; this is for a provider
        // that breaks that contract, which must still never reach the caller
        // as an exception.
        logger.error?.({ err: error }, "the browser-direct backing call threw instead of degrading");
        return degraded("checkBacking", "call_failed");
      }
    },
  };
}

// Still degraded, and not because nobody got to it: identity-check.compact
// has no TypeScript binding — no compiled-contract export in
// contract/src/index.ts and no identityAttestation witness — and building
// one needs a JubJub/Poseidon signer this repository does not have. The
// browser-direct path reaches exactly as far as the backing one does; it has
// no second contract to join. See api/README.md.
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
        "lace identity port reached a complete browser provider stack; identity-check.compact has no TypeScript binding",
      );
      return degraded("checkIdentity", "call_failed");
    },
  };
}
