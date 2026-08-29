// advisor/src/index.ts
// Public surface of the advisor workspace: the port types, the advisor, and
// the two predictors. Consumers import from here so nothing outside the
// workspace depends on an internal module path.

export type { AdvisorFailureReason, AdvisorInput, AdvisorPort, AdvisorResult, Recommendation, Tier } from "./types.js";
export { isTier } from "./types.js";
export { LocalTierAdvisor, type LocalTierPredictor } from "./localTierAdvisor.js";
export {
  createLocalModelPredictor,
  UnsafeModelEndpointError,
  type LocalModelOptions,
} from "./localModelPredictor.js";
export { stubPredictor } from "./stubPredictor.js";
