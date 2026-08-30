// laceDeploy.ts
// Lazy adapter for the browser-direct deployments, alongside lacePort.ts and
// for the same reason: @creva-zk/api/lace reaches Midnight's WebAssembly
// ledger, which is megabytes, so it stays behind a dynamic import that only
// an operator pressing the deploy button ever reaches — and behind the same
// build-time flag that lets the bundler drop it everywhere else.

import type { ApiResult } from '@creva-zk/api';
import { formatIssuerKey } from '@creva-zk/api';
import type { LaceDeployOptions, LaceIdentityDeployOptions } from '@creva-zk/api/lace';

// Written without optional chaining on purpose: Vite substitutes the exact
// text `import.meta.env.VITE_PORT_SOURCE` with a literal, so on every other
// source this folds to `false` at build time and the import below becomes
// unreachable code the bundler drops.
const LACE_BUILD = import.meta.env.VITE_PORT_SOURCE === 'lace';

/** The step every degraded result from these actions carries. */
export const DEPLOY_STEP = 'deployBacking';
export const IDENTITY_DEPLOY_STEP = 'deployIdentity';

// What the screen needs off a finished deployment: an address always, and for
// identity the issuer key beside it, already in the decimal "x:y" the build
// variable takes. Nothing else off the deployment result crosses this line.
export interface DeployOutcome {
  readonly contractAddress: string;
  readonly issuerKey?: string;
}

// The action is contracted never to throw, and a chunk that fails to load is
// exactly the sort of external failure that contract is for.
function loadFailed(step: string): ApiResult<DeployOutcome> {
  return { status: 'degraded', degraded: { step, reason: 'environment_unavailable' } };
}

// Nothing here runs on import: calling this is the deployment.
export async function runLaceDeployment(options: LaceDeployOptions): Promise<ApiResult<DeployOutcome>> {
  if (!LACE_BUILD) return loadFailed(DEPLOY_STEP);
  try {
    const lace = await import('@creva-zk/api/lace');
    return await lace.deployBackingWithLace(options);
  } catch {
    return loadFailed(DEPLOY_STEP);
  }
}

// The identity deployment. Same shape, and the same never-throw contract; it
// hands back the issuer key as well, because a build given only the address
// makes every proof abort on the signature check.
export async function runLaceIdentityDeployment(
  options: LaceIdentityDeployOptions,
): Promise<ApiResult<DeployOutcome>> {
  if (!LACE_BUILD) return loadFailed(IDENTITY_DEPLOY_STEP);
  try {
    const lace = await import('@creva-zk/api/lace');
    const result = await lace.deployIdentityWithLace(options);
    if (result.status === 'degraded') return result;
    // Formatted here, once, by the api's own formatter — the screen never
    // builds this string and the build variable never sees another shape.
    return {
      status: 'ok',
      value: {
        contractAddress: result.value.contractAddress,
        issuerKey: formatIssuerKey(result.value.issuerKey),
      },
    };
  } catch {
    return loadFailed(IDENTITY_DEPLOY_STEP);
  }
}
