// deployTool.ts
// The one gate in front of the operator deployment. A deployment costs tDUST
// and creates a new contract, so it is asked for explicitly or it does not
// exist: the tool is reachable only behind the VITE_LACE_DEPLOY build flag
// or an explicit ?deploy=1 in the URL, and neither of those deploys anything
// by itself — they only put the operator screen on the page, which still has
// to be pressed.
//
// Pure and argument-taking rather than reading import.meta.env directly, so
// the "an ordinary load changes nothing" guarantee is testable.

/** The build flag, and the one value that turns the tool on. */
export const DEPLOY_ENV_FLAG = 'VITE_LACE_DEPLOY';
export const DEPLOY_FLAG_ON = '1';
/** The URL parameter, for an operator who cannot rebuild. */
export const DEPLOY_QUERY_PARAM = 'deploy';

// Only the one key is read, so a caller can pass import.meta.env whole.
export interface DeployToolEnv {
  readonly VITE_LACE_DEPLOY?: string;
}

// True only for the exact opt-ins. Everything else — the flag absent, empty,
// '0', 'false', 'true', the parameter present with any other value — is the
// ordinary app, unchanged. An opt-in this expensive is never inferred.
export function isDeployToolRequested(env: DeployToolEnv | undefined, search: string | undefined): boolean {
  if (env?.VITE_LACE_DEPLOY === DEPLOY_FLAG_ON) return true;
  if (search === undefined || search === '') return false;
  try {
    return new URLSearchParams(search).get(DEPLOY_QUERY_PARAM) === DEPLOY_FLAG_ON;
  } catch {
    // A search string the URL parser refuses is not an opt-in.
    return false;
  }
}
