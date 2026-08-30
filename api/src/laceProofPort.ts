// api/src/laceProofPort.ts
// The browser-direct implementation of both proof ports: the browser talks
// to Midnight itself, with Lace as the wallet and no Node process in
// between. Each call runs a preflight that can fail five distinguishable
// ways — wallet absent, wallet locked, wrong network, local proof server
// unreachable, contract not found — builds the six providers in the page,
// and then JOINS the backing contract rather than deploying one.
//
// The identity port works the same way: it joins the identity contract the
// build names and calls proveIdentity with the issuer key the build names.
// Both are needed — the circuit verifies the attestation's signature against
// that key — and without either one it joins nothing and degrades
// contract_not_found. The preflight still runs first, exactly as it does on
// the backing side, so the reason that comes back always names the FIRST
// thing to fix: a wallet that is missing is worth saying before a build
// variable that is. See VITE_IDENTITY_CONTRACT_ADDRESS and
// VITE_IDENTITY_ISSUER_KEY in web/src/vite-env.d.ts.
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
// Static, like backingClaim above and for the same reason: identityClaim.ts
// holds no compiled circuit, only the Bytes<32> decoding both sides share.
// Reused rather than repeated — a second copy of it here would be a second
// place for "32 bytes of hex, or nothing" to drift.
import { taxIdBytes } from "./identityClaim.js";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS, TIMED_OUT, withTimeout } from "./timeouts.js";

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
// The identity circuit's own module, type-only for the same reason.
type IdentityModule = typeof import("./identityContract.js");
type IdentityProviders = Parameters<IdentityModule["joinIdentity"]>[0];
type JoinIdentity = IdentityModule["joinIdentity"];
type CallProveIdentity = IdentityModule["callProveIdentity"];

// The address Lace's own "Settings » Midnight » Local" proof server listens
// on. Used only when the wallet does not report one of its own, so a user
// who pointed Lace somewhere else is still proved against their choice.
export const DEFAULT_LOCAL_PROOF_SERVER_URL = "http://localhost:6300";

// Every budget on this path lives in timeouts.js, next to the helper that
// spends it. Re-exported because callers of this port already look here.
export { DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS };

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
  /**
   * Hex address of the identity contract, deployed once by the operator tool.
   * Without it the identity port has nothing to join, which is
   * contract_not_found — it never falls back to deploying one.
   */
  readonly identityContractAddress?: string;
  /**
   * The issuer key `proveIdentity` is called with, as the (x, y) pair the
   * circuit takes. The operator tool prints it beside the address, and the
   * two travel together: the circuit verifies the attestation's signature
   * against this key, so a build that names only the address makes every
   * proof abort. Absent, the port degrades contract_not_found rather than
   * paying for a proof it already knows cannot clear.
   */
  readonly identityIssuerKey?: JubjubPoint;
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
  // The identity path's own seams, for the same reason.
  readonly joinIdentity?: JoinIdentity;
  readonly callIdentity?: CallProveIdentity;
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
    // Two bounds, not one. The abort is the real cancellation — it stops the
    // request rather than just stopping the wait — but it only ends this
    // wait if the fetch honours the signal, and the same budget through
    // withTimeout ends it even when nothing ever settles that promise.
    const response = await withTimeout(
      doFetch(url, {
        method: "GET",
        headers: { "Content-Type": PROOF_REQUEST_CONTENT_TYPE },
        signal: controller.signal,
      }),
      timeoutMs,
    );
    if (response === TIMED_OUT) {
      logger.error?.({ timeoutMs, proofServerUrl: url }, "local proof server never answered the probe");
      return false;
    }
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
      // The preflight is inside the catch too: every layer below degrades
      // rather than throwing, and this is the backstop for one that breaks
      // that contract. Nothing reaches the caller as an exception.
      try {
        const stack = await prepareLaceStack<CircuitId, PrivateStateId, BackingPrivateState>("checkBacking", options);
        if (stack.status === "degraded") {
          logger.info({ reason: stack.degraded.reason }, "lace backing port preflight degraded");
          return stack;
        }
        return await proveBacking("checkBacking", requestedLimit, options, stack.value.providers, logger);
      } catch (error) {
        logger.error?.({ err: error }, "the browser-direct backing call threw instead of degrading");
        return degraded("checkBacking", "call_failed");
      }
    },
  };
}

// Loaded on the first identity call, not at module scope, for the same
// reason loadContract is: a build without the compiled circuit gets a typed
// degraded result here rather than an import error.
async function loadIdentity(logger: PortLogger): Promise<ApiResult<IdentityModule>> {
  try {
    return { status: "ok", value: await import("./identityContract.js") };
  } catch (error) {
    logger.error?.({ err: error }, "compiled identity contract is missing — run npm run compact:build");
    return { status: "degraded", degraded: { step: "join", reason: "contract_not_compiled" } };
  }
}

// Everything after the preflight on the identity side: join the identity
// contract the build named and call proveIdentity with the issuer key the
// build named. Every degraded result is re-stamped with this port's own step.
async function proveIdentity(
  step: string,
  expectedTaxIdHash: string,
  options: LaceOptions,
  providers: IdentityProviders,
  logger: PortLogger,
): Promise<ApiResult<boolean>> {
  const contractAddress = options.identityContractAddress?.trim();
  const issuerKey = options.identityIssuerKey;
  if (contractAddress === undefined || contractAddress === "" || issuerKey === undefined) {
    // The two travel together or neither is usable: an address with no key
    // makes verifyAttestation abort on every call, and a key with no address
    // has nothing to be checked against. Both absences are the same
    // precondition — this build was never pointed at a deployment.
    logger.error?.(
      { hasAddress: contractAddress !== undefined && contractAddress !== "", hasIssuerKey: issuerKey !== undefined },
      "no identity deployment — set VITE_IDENTITY_CONTRACT_ADDRESS and VITE_IDENTITY_ISSUER_KEY",
    );
    return degraded(step, "contract_not_found");
  }

  let expected: Uint8Array;
  try {
    expected = taxIdBytes(expectedTaxIdHash);
  } catch (error) {
    // A malformed argument is not a degraded external system, but it is
    // still not an exception the caller has to catch: the predicate simply
    // cannot be stated, so nothing was decided.
    logger.error?.({ err: error }, "expectedTaxIdHash is not a 32-byte hex string");
    return degraded(step, "call_failed");
  }

  let join = options.joinIdentity;
  let call = options.callIdentity;
  if (join === undefined || call === undefined) {
    const loaded = await loadIdentity(logger);
    if (loaded.status === "degraded") return restep(step, loaded);
    join ??= loaded.value.joinIdentity;
    call ??= loaded.value.callProveIdentity;
  }

  const joined = await join(providers, contractAddress, logger, options.joinTimeoutMs);
  if (joined.status === "degraded") return restep(step, joined);

  const outcome = await call(joined.value, issuerKey, expected, logger);
  if (outcome.status === "degraded") return restep(step, outcome);

  logger.info(
    { matched: outcome.value.matched, answered: outcome.value.answered.toString() },
    "proveIdentity answered in the browser",
  );
  return { status: "ok", value: outcome.value.matched };
}

// Joins the identity contract the build names and answers with the circuit's
// own boolean. The issuer key the SCREEN passes is deliberately ignored: the
// browser cannot know which issuer signed the deployment's attestation, and a
// key this app invented is not that issuer — naming one is exactly what makes
// verifyAttestation abort. The build's key is the only one that can be right.
export function createLaceIdentityPort(options: LaceOptions = {}): IdentityProofPort {
  const logger = options.logger ?? noopLogger;
  return {
    async checkIdentity(_issuerKey: JubjubPoint, expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      // The preflight is inside the catch too: every layer below degrades
      // rather than throwing, and this is the backstop for one that breaks
      // that contract. Nothing reaches the caller as an exception.
      try {
        const stack = await prepareLaceStack<string, string, unknown>("checkIdentity", options);
        if (stack.status === "degraded") {
          logger.info({ reason: stack.degraded.reason }, "lace identity port preflight degraded");
          return stack;
        }
        return await proveIdentity(
          "checkIdentity",
          expectedTaxIdHash,
          options,
          stack.value.providers as unknown as IdentityProviders,
          logger,
        );
      } catch (error) {
        logger.error?.({ err: error }, "the browser-direct identity call threw instead of degrading");
        return degraded("checkIdentity", "call_failed");
      }
    },
  };
}
