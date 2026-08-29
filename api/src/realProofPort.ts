// api/src/realProofPort.ts
// The real implementation of both proof ports: NODE ONLY. checkBacking now
// runs the actual circuit — it starts the local network, deploys the backing
// contract once, and calls proveBacking through contract.ts on every request.
//
// ONE DEPLOYMENT PER PROCESS. Starting the network and deploying costs ~19s
// on top of each ~23.7s proof, so the first call pays for both and every
// later call pays only for the proof. The deployment is memoised for the
// process lifetime; a degraded start is deliberately not memoised, so a
// long-lived server can recover once Docker is actually up.
//
// EXCLUSIVE LOCK. The deployment owns the private-state LevelDB, whose lock
// is exclusive for as long as the process holds it. Exactly one process may
// hold it: `npm run serve` and `npm run demo` cannot run at the same time,
// and a second `serve` will degrade rather than share it.
//
// The compiled contract is imported lazily, on first deployment. Importing
// it at module scope would make this file unloadable — and `npm run serve`
// uncrashable-into — on a machine where `npm run compact:build` has not run,
// which is a typed degraded result's job, not an import error's.

import pino, { type Logger } from "pino";
import type { ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";
import type { PortLogger } from "./portLogger.js";
import { startLocalEnvironment, type LocalEnvironmentHandle } from "./localEnvironment.js";
import { createProviders } from "./providers.js";
import { zkConfigPath } from "./zkConfigPath.js";
import { DEFAULT_COLLATERAL_AMOUNT, TIER_PROVEN_BY_CLEARED_BACKING } from "./backingClaim.js";

// Type-only, so nothing here loads the compiled contract at module scope.
// Every shape below is read off that module rather than restated, so the two
// cannot drift apart.
type ContractModule = typeof import("./contract.js");
type BackingProviders = Parameters<ContractModule["deployBacking"]>[0];
// What the call step takes. Since the browser joins rather than deploys,
// that parameter is the wider "found contract"; a deployment is one.
type FoundBacking = Parameters<ContractModule["callProveBacking"]>[0];
type CircuitId = ContractModule["BACKING_CIRCUIT_ID"];
type PrivateStateId = ContractModule["BACKING_PRIVATE_STATE_ID"];
type BackingPrivateState = ReturnType<ContractModule["createBackingPrivateState"]>;
type CallProveBacking = ContractModule["callProveBacking"];

export type { PortLogger };

// Both live in backingClaim.ts now, so the browser-direct port reads the
// same two values without importing this Node-only module. Re-exported here
// because api/src/real.ts is where a caller has always found them.
export { DEFAULT_COLLATERAL_AMOUNT, TIER_PROVEN_BY_CLEARED_BACKING };

export interface RealPortOptions {
  readonly logger?: Logger;
  readonly collateralAmount?: bigint;
  // Test seams. Every one of them defaults to the real thing; they exist so
  // the reuse, degrade and never-throw contracts can be exercised without
  // Docker, a proof server or a 23.7s wait.
  readonly startEnvironment?: typeof startLocalEnvironment;
  readonly buildProviders?: (environment: LocalEnvironmentHandle) => BackingProviders;
  readonly deploy?: (providers: BackingProviders, collateralAmount: bigint, logger: Logger) => Promise<ApiResult<FoundBacking>>;
  readonly call?: CallProveBacking;
}

interface Deployment {
  readonly deployed: FoundBacking;
  readonly environment: LocalEnvironmentHandle;
  readonly call: CallProveBacking;
}

// pino's own way of building a logger that writes nothing. A port called
// from a library — a test, another workspace — must not print to stdout
// just by existing.
function silentLogger(): Logger {
  return pino({ level: "silent" });
}

// Loaded once, on the first deployment. A machine without the compiled
// circuit gets a typed degraded result here rather than an import error at
// process start.
async function loadContract(logger: Logger): Promise<ApiResult<ContractModule>> {
  try {
    return { status: "ok", value: await import("./contract.js") };
  } catch (error) {
    logger.error({ err: error }, "compiled backing contract is missing — run npm run compact:build");
    return { status: "degraded", degraded: { step: "deploy", reason: "contract_not_compiled" } };
  }
}

function defaultProviders(environment: LocalEnvironmentHandle): BackingProviders {
  return createProviders<CircuitId, PrivateStateId, BackingPrivateState>(
    environment.configuration,
    environment.walletProvider,
    zkConfigPath(),
  );
}

// Module-level on purpose: the deployment is shared by both ports and by
// every request the serve process handles, which is the whole point of
// paying the ~19s once.
let deploymentPromise: Promise<ApiResult<Deployment>> | undefined;

async function openDeployment(options: RealPortOptions, logger: Logger): Promise<ApiResult<Deployment>> {
  const start = options.startEnvironment ?? startLocalEnvironment;

  try {
    // The compiled circuit is only needed for the steps the caller has not
    // overridden — a caller that supplies both (a test) never loads it. The
    // provider wiring no longer needs it: the ZK config path moved out.
    const needsContract = options.deploy === undefined || options.call === undefined;
    let contract: ContractModule | undefined;
    if (needsContract) {
      const loaded = await loadContract(logger);
      if (loaded.status === "degraded") return loaded;
      contract = loaded.value;
    }

    const started = await start(logger);
    if (started.status === "degraded") return started;
    const environment = started.value;

    const build = options.buildProviders ?? defaultProviders;
    const deploy = options.deploy ?? mustLoad(contract).deployBacking;
    const call = options.call ?? mustLoad(contract).callProveBacking;

    const deployed = await deploy(build(environment), options.collateralAmount ?? DEFAULT_COLLATERAL_AMOUNT, logger);
    if (deployed.status === "degraded") {
      // Release the exclusive private-state lock before giving up, so the
      // next attempt — or the demo runner — is not locked out by a
      // half-started process.
      await environment.shutdown().catch(() => undefined);
      return deployed;
    }

    return { status: "ok", value: { deployed: deployed.value, environment, call } };
  } catch (error) {
    logger.error({ err: error }, "deployment threw instead of degrading");
    return { status: "degraded", degraded: { step: "deploy", reason: "deploy_failed" } };
  }
}

// Memoises the deployment, and only a live one: a degraded start clears the
// cache so a server that outlives a Docker restart can pick it up. Every
// concurrent caller shares one in-flight attempt, so two requests arriving
// together never start two networks.
function deployment(options: RealPortOptions, logger: Logger): Promise<ApiResult<Deployment>> {
  if (deploymentPromise === undefined) {
    const attempt = openDeployment(options, logger).then((result) => {
      if (result.status === "degraded" && deploymentPromise === attempt) {
        deploymentPromise = undefined;
      }
      return result;
    });
    deploymentPromise = attempt;
  }
  return deploymentPromise;
}

// Shuts the shared deployment down and releases the private-state lock.
// Best-effort and never throws: it runs on a signal handler, where a throw
// would take the exit code with it.
export async function shutdownRealPorts(): Promise<void> {
  const pending = deploymentPromise;
  deploymentPromise = undefined;
  if (pending === undefined) return;

  const settled = await pending.catch(() => undefined);
  if (settled !== undefined && settled.status === "ok") {
    await settled.value.environment.shutdown().catch(() => undefined);
  }
}

export function createRealBackingPort(logger: Logger | PortLogger = silentLogger(), options: RealPortOptions = {}): BackingProofPort {
  // serve.ts hands this a pino Logger; a caller with only a PortLogger gets
  // a silent pino for the deploy/call path, which needs the error level.
  const pinoLogger: Logger = options.logger ?? (isPinoLogger(logger) ? logger : silentLogger());

  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      const opened = await deployment(options, pinoLogger);
      if (opened.status === "degraded") return opened;

      // ~23.7s, measured. Nothing but the circuit call sits between here and
      // the result. contract.ts already degrades rather than throwing; the
      // catch is for a prover that breaks that contract, which must still
      // never reach the caller as an exception.
      let outcome: Awaited<ReturnType<CallProveBacking>>;
      try {
        outcome = await opened.value.call(opened.value.deployed, requestedLimit, pinoLogger);
      } catch (error) {
        pinoLogger.error({ err: error }, "proveBacking threw instead of degrading");
        return { status: "degraded", degraded: { step: "call", reason: "call_failed" } };
      }
      if (outcome.status === "degraded") return outcome;

      logger.info(
        { requestedLimit: requestedLimit.toString(), cleared: outcome.value.cleared, answered: outcome.value.answered.toString() },
        "proveBacking answered",
      );
      return { status: "ok", value: outcome.value.cleared ? TIER_PROVEN_BY_CLEARED_BACKING : "none" };
    },
  };
}

// Still degraded, and for a reason that is not "nobody got to it": there is
// no TypeScript binding for identity-check.compact — no compiled-contract
// export in contract/src/index.ts and no identityAttestation witness — and
// building one needs a JubJub/Poseidon signer this repository does not have.
// attestation/src/signing.ts says so itself: it signs with Ed25519 as an
// explicit stand-in, so an attestation issued today fails schnorrVerify
// inside the circuit. Wiring a deploy/call here would produce a port that
// aborts on every proof while looking finished, which is worse than saying
// so. See api/README.md.
export function createRealIdentityPort(logger: Logger | PortLogger = silentLogger()): IdentityProofPort {
  return {
    async checkIdentity(issuerKey: JubjubPoint, expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      logger.info(
        { issuerKeyX: issuerKey.x.toString(), issuerKeyY: issuerKey.y.toString(), expectedTaxIdHash },
        "real identity port called; the Schnorr signer exists now, but identity-check.compact still has no TypeScript binding",
      );
      return { status: "degraded", degraded: { step: "checkIdentity", reason: "contract_not_compiled" } };
    },
  };
}

// The branch above loads the module whenever any of the three defaults is
// still in play, so an undefined here is a bug in this file, not a state a
// caller can reach.
function mustLoad(contract: ContractModule | undefined): ContractModule {
  if (contract === undefined) throw new Error("compiled contract was needed but never loaded");
  return contract;
}

// pino's Logger carries the error level the contract layer logs through; a
// bare PortLogger does not.
function isPinoLogger(logger: Logger | PortLogger): logger is Logger {
  return typeof (logger as Logger).error === "function";
}
