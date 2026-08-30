// laceDeploy.ts
// Lazy adapter for the browser-direct deployment, alongside lacePort.ts and
// for the same reason: @creva-zk/api/lace reaches Midnight's WebAssembly
// ledger, which is megabytes, so it stays behind a dynamic import that only
// an operator pressing the deploy button ever reaches — and behind the same
// build-time flag that lets the bundler drop it everywhere else.

import type { ApiResult } from '@creva-zk/api';
import type { LaceDeployOptions, LaceDeployment } from '@creva-zk/api/lace';

// Written without optional chaining on purpose: Vite substitutes the exact
// text `import.meta.env.VITE_PORT_SOURCE` with a literal, so on every other
// source this folds to `false` at build time and the import below becomes
// unreachable code the bundler drops.
const LACE_BUILD = import.meta.env.VITE_PORT_SOURCE === 'lace';

/** The step every degraded result from this action carries. */
export const DEPLOY_STEP = 'deployBacking';

// The action is contracted never to throw, and a chunk that fails to load is
// exactly the sort of external failure that contract is for.
function loadFailed(): ApiResult<LaceDeployment> {
  return { status: 'degraded', degraded: { step: DEPLOY_STEP, reason: 'environment_unavailable' } };
}

// Nothing here runs on import: calling this is the deployment.
export async function runLaceDeployment(options: LaceDeployOptions): Promise<ApiResult<LaceDeployment>> {
  if (!LACE_BUILD) return loadFailed();
  try {
    const lace = await import('@creva-zk/api/lace');
    return await lace.deployBackingWithLace(options);
  } catch {
    return loadFailed();
  }
}
