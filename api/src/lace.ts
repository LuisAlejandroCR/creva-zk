// api/src/lace.ts
// Second entry point, for the browser-direct path only. Kept apart from
// index.ts on purpose: this one reaches Midnight's ledger, which is
// WebAssembly, and a build that is not on the 'lace' source must never pay
// for it. The seam in web/ imports this lazily.

export {
  createLaceBackingPort,
  createLaceIdentityPort,
  DEFAULT_LOCAL_PROOF_SERVER_URL,
  DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS,
  PROOF_REQUEST_CONTENT_TYPE,
  prepareLaceStack,
  probeProofServer,
  type LaceOptions,
  type LaceStack,
} from "./laceProofPort.js";
export {
  deployBackingWithLace,
  DEFAULT_DEPLOY_TIMEOUT_MS,
  DEPLOY_STEP,
  type LaceDeployOptions,
  type LaceDeployment,
} from "./laceDeploy.js";
export { DEFAULT_COLLATERAL_AMOUNT, TIER_PROVEN_BY_CLEARED_BACKING } from "./backingClaim.js";
export { DEFAULT_LACE_NETWORK_ID, type ConnectorHost, type LaceConnection } from "./laceWallet.js";
export { DEFAULT_ZK_CONFIG_BASE_URL, FetchZkConfigProvider, type LaceProviderOptions } from "./laceProviders.js";
