// api/src/laceDeploy.ts
// The operator-only deployment on the browser-direct path: connects Lace,
// builds the same six providers a proof uses, deploys the backing contract
// once with the user's own wallet, and hands back nothing but the address.
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
