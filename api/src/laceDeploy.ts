// api/src/laceDeploy.ts
// The operator-only deployments on the browser-direct path: connects Lace,
// builds the same six providers a proof uses, deploys the backing contract or
// the identity contract once with the user's own wallet, and hands back the
// address (and, for identity, the issuer key a proof cannot do without).
// It is not part of the product journey — a deployment costs tDUST and
// creates a new contract, so nothing here ever runs on its own.
//
// Reuses, rather than repeats: prepareLaceStack for the preflight (wallet
// absent / locked / wrong network / proof server unreachable), deployBacking
// from contract.ts for the deployment itself, and withTimeout for the bound.
// There is no second deploy path in this repository.

import { prepareLaceStack, type LaceOptions } from "./laceProofPort.js";
import { degraded } from "./laceWallet.js";
import { DEFAULT_COLLATERAL_AMOUNT } from "./backingClaim.js";
import { DEFAULT_DEPLOY_TIMEOUT_MS, TIMED_OUT, withTimeout } from "./timeouts.js";
import type { PortLogger } from "./portLogger.js";
import type { JubjubPoint } from "./proofPort.js";
import type { ApiDegraded, ApiResult } from "./types.js";

// Type-only, exactly as laceProofPort.ts does it: the compiled contract is
// WebAssembly and must not load at module scope. Every shape is read off
// that module rather than restated, so the two cannot drift apart.
type ContractModule = typeof import("./contract.js");
type DeployBacking = ContractModule["deployBacking"];
type DeployProviders = Parameters<DeployBacking>[0];

// One step name for the whole action, so the screen never has to know which
// layer gave up — the reason is the part that matters.
export const DEPLOY_STEP = "deployBacking";

// Re-exported because a caller configuring this action already looks here
// for its budget.
export { DEFAULT_DEPLOY_TIMEOUT_MS };

export interface LaceDeployOptions extends LaceOptions {
  /** How long the whole deployment may take; see DEFAULT_DEPLOY_TIMEOUT_MS. */
  readonly deployTimeoutMs?: number;
  /** Test seam. Defaults to contract.ts's deployBacking, loaded lazily. */
  readonly deploy?: DeployBacking;
}

// Deliberately the address and nothing else. The deployment result carries
// the signing key and the initial private state as well, and those are
// exactly what must not leave this function — the operator needs one public
// string to paste into a build.
export interface LaceDeployment {
  readonly contractAddress: string;
}

const noopLogger: PortLogger = { info: () => undefined };

// Loaded on the first deployment, not at module scope, for the same reason
// laceProofPort.ts loads it late: a build without the compiled circuit gets
// a typed degraded result rather than an import error.
async function loadDeployBacking(logger: PortLogger): Promise<ApiResult<DeployBacking>> {
  try {
    const module = await import("./contract.js");
    return { status: "ok", value: module.deployBacking };
  } catch (error) {
    logger.error?.({ err: error }, "compiled backing contract is missing — run npm run compact:build");
    return degraded(DEPLOY_STEP, "contract_not_compiled");
  }
}

// The layers below name their own step ("deploy"); this action's contract
// with its screen is that the step is the action's. The reason travels
// untouched — that is the part the operator reads.
function restep<T>(result: { readonly degraded: ApiDegraded }): ApiResult<T> {
  return { status: "degraded", degraded: { step: DEPLOY_STEP, reason: result.degraded.reason } };
}

// Deploys the backing contract from the browser, with Lace as the wallet.
// NEVER THROWS, and never runs by itself: something has to call it.
//
// Every failure is one of the reasons that already exist — the wallet ones
// come from connectLaceWallet, an unreachable local proof server from the
// preflight's own probe, and insufficient funds or a refused signature are
// the same deploy_failed deployBacking already returns, because to an
// operator they are one thing: the deployment did not happen.
export async function deployBackingWithLace(options: LaceDeployOptions = {}): Promise<ApiResult<LaceDeployment>> {
  const logger = options.logger ?? noopLogger;
  try {
    const stack = await prepareLaceStack<string, string, unknown>(DEPLOY_STEP, options);
    if (stack.status === "degraded") {
      logger.info({ reason: stack.degraded.reason }, "lace deploy preflight degraded");
      return stack;
    }

    let deploy = options.deploy;
    if (deploy === undefined) {
      const loaded = await loadDeployBacking(logger);
      if (loaded.status === "degraded") return restep(loaded);
      deploy = loaded.value;
    }

    // The stack is built generically over circuit and private-state ids; the
    // deployment needs the backing contract's own. They are the same six
    // providers either way — prepareLaceStack builds them from the wallet,
    // not from the contract.
    const providers = stack.value.providers as unknown as DeployProviders;

    const budget = options.deployTimeoutMs ?? DEFAULT_DEPLOY_TIMEOUT_MS;
    const deployed = await withTimeout(
      deploy(providers, options.collateralAmount ?? DEFAULT_COLLATERAL_AMOUNT, logger),
      budget,
    );
    if (deployed === TIMED_OUT) {
      // Bounded, but never silent: a deployment that hit this budget may
      // still land on chain, and the operator has to be told to look before
      // paying for a second one. See DEFAULT_DEPLOY_TIMEOUT_MS.
      logger.error?.({ timeoutMs: budget }, "deployment never confirmed — it may still land; check before deploying again");
      return degraded(DEPLOY_STEP, "deploy_failed");
    }
    if (deployed.status === "degraded") return restep(deployed);

    // Only the address is read off the result. The rest of deployTxData is
    // the signing key and the initial private state, which stay here.
    const contractAddress = deployed.value.deployTxData.public.contractAddress;
    if (typeof contractAddress !== "string" || contractAddress === "") {
      logger.error?.({}, "deployment reported no contract address");
      return degraded(DEPLOY_STEP, "deploy_failed");
    }

    logger.info({ contractAddress }, "backing contract deployed from the browser");
    return { status: "ok", value: { contractAddress } };
  } catch (error) {
    // The backstop. Every layer below degrades rather than throwing; this is
    // for one that breaks that contract, so nothing reaches the caller as an
    // exception.
    logger.error?.({ err: error }, "the browser-direct deployment threw instead of degrading");
    return degraded(DEPLOY_STEP, "deploy_failed");
  }
}

// ---------------------------------------------------------------------------
// The identity deployment. Same shape as the backing one above and for the
// same reasons; what differs is what it hands back and what it costs the
// operator to lose: a deployment with no issuer key is a contract nobody can
// prove against, so both values come out together or neither does.
// ---------------------------------------------------------------------------

// Type-only, exactly as above: the compiled identity circuit is WebAssembly
// and must not load at module scope.
type IdentityModule = typeof import("./identityContract.js");
type IdentityClaimModule = typeof import("./identityClaim.js");
type DeployIdentity = IdentityModule["deployIdentity"];
type IdentityDeployProviders = Parameters<DeployIdentity>[0];

/** One step name for the whole action, as with the backing deployment. */
export const IDENTITY_DEPLOY_STEP = "deployIdentity";

export interface LaceIdentityDeployOptions extends LaceOptions {
  /** How long the whole deployment may take; see DEFAULT_DEPLOY_TIMEOUT_MS. */
  readonly deployTimeoutMs?: number;
  // Test seams. Each defaults to the real thing, loaded lazily; they exist so
  // the degrade and never-throw contracts can be exercised without a browser,
  // a wallet, a proof server or the compiled circuit.
  readonly deployIdentity?: DeployIdentity;
  readonly issue?: IdentityClaimModule["issueIdentityAttestation"];
  readonly claim?: IdentityClaimModule["defaultIdentityClaim"];
  /** The contract's own challenge circuit. Nothing else may reimplement it. */
  readonly challenge?: IdentityModule["identityAttestationChallenge"];
}

// BOTH values, deliberately. The address alone is useless: the circuit
// verifies the attestation's signature against the issuer key the caller
// names, so a build that knows only where the contract lives makes every
// proof abort — which reads on screen as "todavía no se puede" about an
// identity that was in fact valid.
export interface LaceIdentityDeployment {
  readonly contractAddress: string;
  /** Decimal (x, y). Never a compressed point — see identityIssuerKey.ts. */
  readonly issuerKey: JubjubPoint;
}

async function loadIdentityModules(
  logger: PortLogger,
): Promise<ApiResult<{ readonly contract: IdentityModule; readonly claim: IdentityClaimModule }>> {
  try {
    const [contract, claim] = await Promise.all([import("./identityContract.js"), import("./identityClaim.js")]);
    return { status: "ok", value: { contract, claim } };
  } catch (error) {
    logger.error?.({ err: error }, "compiled identity contract is missing — run npm run compact:build");
    return degraded(IDENTITY_DEPLOY_STEP, "contract_not_compiled");
  }
}

function restepIdentity<T>(result: { readonly degraded: ApiDegraded }): ApiResult<T> {
  return { status: "degraded", degraded: { step: IDENTITY_DEPLOY_STEP, reason: result.degraded.reason } };
}

// Deploys the identity contract from the browser, with Lace as the wallet.
// NEVER THROWS, and never runs by itself.
//
// The attestation it deploys with is issued right here, by a synthetic issuer
// whose Schnorr key is generated in the page — the same thing
// realIdentityPort.ts does in a Node process. It is signed through the
// CONTRACT'S OWN challenge circuit, never a second copy of that hash, which
// is the only reason the proof later clears instead of aborting.
//
// The private state this writes is what a later proof reads: the attestation
// is the caller's, not the deployment's, and only the issuer that signed it
// can produce one. See joinIdentity in identityContract.ts.
export async function deployIdentityWithLace(
  options: LaceIdentityDeployOptions = {},
): Promise<ApiResult<LaceIdentityDeployment>> {
  const logger = options.logger ?? noopLogger;
  try {
    const stack = await prepareLaceStack<string, string, unknown>(IDENTITY_DEPLOY_STEP, options);
    if (stack.status === "degraded") {
      logger.info({ reason: stack.degraded.reason }, "lace identity deploy preflight degraded");
      return stack;
    }

    let deploy = options.deployIdentity;
    let issue = options.issue;
    let claim = options.claim;
    let challenge = options.challenge;
    if (deploy === undefined || issue === undefined || claim === undefined || challenge === undefined) {
      const loaded = await loadIdentityModules(logger);
      if (loaded.status === "degraded") return restepIdentity(loaded);
      deploy ??= loaded.value.contract.deployIdentity;
      issue ??= loaded.value.claim.issueIdentityAttestation;
      claim ??= loaded.value.claim.defaultIdentityClaim;
      challenge ??= loaded.value.contract.identityAttestationChallenge;
    }

    // The claim is the demo's own: a verified adult whose tax-ID hash is the
    // single synthetic one identityDemo.ts owns, so the value this deployment
    // attests to and the value the screen later asks about are the same bytes.
    const issued = await issue(challenge, claim());

    const providers = stack.value.providers as unknown as IdentityDeployProviders;

    const budget = options.deployTimeoutMs ?? DEFAULT_DEPLOY_TIMEOUT_MS;
    const deployed = await withTimeout(deploy(providers, issued.attestation as never, logger), budget);
    if (deployed === TIMED_OUT) {
      logger.error?.(
        { timeoutMs: budget },
        "identity deployment never confirmed — it may still land; check before deploying again",
      );
      return degraded(IDENTITY_DEPLOY_STEP, "deploy_failed");
    }
    if (deployed.status === "degraded") return restepIdentity(deployed);

    const contractAddress = deployed.value.deployTxData.public.contractAddress;
    if (typeof contractAddress !== "string" || contractAddress === "") {
      logger.error?.({}, "identity deployment reported no contract address");
      return degraded(IDENTITY_DEPLOY_STEP, "deploy_failed");
    }

    // The issuer's PUBLIC key only. The secret that signed the attestation
    // was generated in this page, was never written anywhere, and dies with
    // the call — nothing here may hand it out.
    logger.info(
      { contractAddress, issuerKeyX: issued.issuerKey.x.toString(), issuerKeyY: issued.issuerKey.y.toString() },
      "identity contract deployed from the browser",
    );
    return { status: "ok", value: { contractAddress, issuerKey: issued.issuerKey } };
  } catch (error) {
    logger.error?.({ err: error }, "the browser-direct identity deployment threw instead of degrading");
    return degraded(IDENTITY_DEPLOY_STEP, "deploy_failed");
  }
}
