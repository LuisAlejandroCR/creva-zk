// api/src/realIdentityPort.ts
// The real identity port: NODE ONLY. Deploys identity-check.compact once per
// process, holding a signed attestation as witness-only private state, and
// calls proveIdentity on every request.
//
// The attestation is issued here, by a synthetic issuer, because Creva's KYC
// provider signs nothing today. What is NOT synthetic is the verification:
// the signature is Schnorr over Jubjub, produced through the contract's own
// challenge circuit, and verifyAttestation checks it inside the proof. An
// attestation this port did not issue — a different issuer key — makes the
// circuit abort, and that comes back degraded, never as "she did not match".
//
// The compiled contract is imported lazily, on first deployment, so a
// machine where `npm run compact:build` has not run gets a typed degraded
// result rather than an import error at process start.

import pino, { type Logger } from "pino";
import type { ApiResult } from "./types.js";
import type { IdentityProofPort, JubjubPoint } from "./proofPort.js";
import type { PortLogger } from "./portLogger.js";
import { sharedEnvironment, type StartEnvironment } from "./sharedEnvironment.js";
import { createProviders } from "./providers.js";
import { identityZkConfigPath } from "./zkConfigPath.js";
import {
  DEFAULT_TAX_ID_HEX,
  defaultIdentityClaim,
  issueIdentityAttestation,
  taxIdBytes,
  type IdentityClaimBytes,
} from "./identityClaim.js";
import type { LocalEnvironmentHandle } from "./localEnvironment.js";

// Type-only, so nothing here loads the compiled contract at module scope.
type IdentityModule = typeof import("./identityContract.js");
type IdentityProviders = Parameters<IdentityModule["deployIdentity"]>[0];
type DeployedIdentity = Parameters<IdentityModule["callProveIdentity"]>[0];
type CallProveIdentity = IdentityModule["callProveIdentity"];

export { DEFAULT_TAX_ID_HEX };

export interface RealIdentityPortOptions {
  readonly logger?: Logger;
  // The claim the deployment attests to. Synthetic by default; a caller that
  // supplies one is still bound by the same signature check.
  readonly claim?: IdentityClaimBytes;
  // Fixes the issuer's Schnorr key, so a caller can name the same issuer
  // across processes. Random per process when absent.
  readonly issuerSecretKey?: bigint;
  // Test seams. Each defaults to the real thing; they exist so the reuse,
  // degrade and never-throw contracts can be exercised without Docker, a
  // proof server or a ~24s wait.
  readonly startEnvironment?: StartEnvironment;
  readonly buildProviders?: (environment: LocalEnvironmentHandle) => IdentityProviders;
  readonly deploy?: IdentityModule["deployIdentity"];
  readonly call?: CallProveIdentity;
}

interface IdentityDeployment {
  readonly deployed: DeployedIdentity;
  readonly issuerKey: JubjubPoint;
  readonly call: CallProveIdentity;
}

function silentLogger(): Logger {
  return pino({ level: "silent" });
}

async function loadIdentityContract(logger: Logger): Promise<ApiResult<IdentityModule>> {
  try {
    return { status: "ok", value: await import("./identityContract.js") };
  } catch (error) {
    logger.error({ err: error }, "compiled identity contract is missing — run npm run compact:build");
    return { status: "degraded", degraded: { step: "deploy", reason: "contract_not_compiled" } };
  }
}

function defaultProviders(environment: LocalEnvironmentHandle): IdentityProviders {
  return createProviders(environment.configuration, environment.walletProvider, identityZkConfigPath());
}

let identityDeploymentPromise: Promise<ApiResult<IdentityDeployment>> | undefined;

async function openIdentityDeployment(
  options: RealIdentityPortOptions,
  logger: Logger,
): Promise<ApiResult<IdentityDeployment>> {
  try {
    const loaded = await loadIdentityContract(logger);
    if (loaded.status === "degraded") return loaded;
    const contract = loaded.value;

    const started = await sharedEnvironment(logger, options.startEnvironment);
    if (started.status === "degraded") return started;

    // Signed through the contract's own challenge circuit — the reason the
    // proof clears instead of aborting on the signature.
    const issued = await issueIdentityAttestation(
      contract.identityAttestationChallenge,
      options.claim ?? defaultIdentityClaim(),
      undefined,
      options.issuerSecretKey,
    );

    const build = options.buildProviders ?? defaultProviders;
    const deploy = options.deploy ?? contract.deployIdentity;
    const call = options.call ?? contract.callProveIdentity;

    const deployed = await deploy(build(started.value), issued.attestation as never, logger);
    if (deployed.status === "degraded") return deployed;

    return { status: "ok", value: { deployed: deployed.value, issuerKey: issued.issuerKey, call } };
  } catch (error) {
    logger.error({ err: error }, "identity deployment threw instead of degrading");
    return { status: "degraded", degraded: { step: "deploy", reason: "deploy_failed" } };
  }
}

// Memoises the deployment, and only a live one: a degraded attempt clears the
// cache so a long-lived server can recover once Docker is actually up.
function identityDeployment(
  options: RealIdentityPortOptions,
  logger: Logger,
): Promise<ApiResult<IdentityDeployment>> {
  if (identityDeploymentPromise === undefined) {
    const attempt = openIdentityDeployment(options, logger).then((result) => {
      if (result.status === "degraded" && identityDeploymentPromise === attempt) {
        identityDeploymentPromise = undefined;
      }
      return result;
    });
    identityDeploymentPromise = attempt;
  }
  return identityDeploymentPromise;
}

// Drops the memoised deployment. The environment it borrowed is shut down by
// shutdownSharedEnvironment, which owns it.
export async function shutdownIdentityPort(): Promise<void> {
  const pending = identityDeploymentPromise;
  identityDeploymentPromise = undefined;
  await pending?.catch(() => undefined);
}

// The issuer key this deployment was signed by. A caller passes it straight
// to checkIdentity; anything else makes the circuit abort, which is the
// correct answer for an attestation from an issuer nobody knows.
export async function realIdentityIssuerKey(
  logger: Logger = silentLogger(),
  options: RealIdentityPortOptions = {},
): Promise<ApiResult<JubjubPoint>> {
  const opened = await identityDeployment(options, options.logger ?? logger);
  if (opened.status === "degraded") return opened;
  return { status: "ok", value: opened.value.issuerKey };
}

export function createRealIdentityPort(
  logger: Logger | PortLogger = silentLogger(),
  options: RealIdentityPortOptions = {},
): IdentityProofPort {
  const pinoLogger: Logger = options.logger ?? (isPinoLogger(logger) ? logger : silentLogger());

  return {
    async checkIdentity(issuerKey: JubjubPoint, expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      let expected: Uint8Array;
      try {
        expected = taxIdBytes(expectedTaxIdHash);
      } catch (error) {
        // A malformed argument is not a degraded external system, but it is
        // still not an exception the caller has to catch. The predicate
        // simply cannot be stated, so nothing was decided.
        pinoLogger.error({ err: error }, "expectedTaxIdHash is not a 32-byte hex string");
        return { status: "degraded", degraded: { step: "checkIdentity", reason: "call_failed" } };
      }

      const opened = await identityDeployment(options, pinoLogger);
      if (opened.status === "degraded") return opened;

      let outcome: Awaited<ReturnType<CallProveIdentity>>;
      try {
        outcome = await opened.value.call(opened.value.deployed, issuerKey, expected, pinoLogger);
      } catch (error) {
        pinoLogger.error({ err: error }, "proveIdentity threw instead of degrading");
        return { status: "degraded", degraded: { step: "call", reason: "call_failed" } };
      }
      if (outcome.status === "degraded") return outcome;

      logger.info(
        { matched: outcome.value.matched, answered: outcome.value.answered.toString() },
        "proveIdentity answered",
      );
      return { status: "ok", value: outcome.value.matched };
    },
  };
}

function isPinoLogger(logger: Logger | PortLogger): logger is Logger {
  return typeof (logger as Logger).error === "function";
}
