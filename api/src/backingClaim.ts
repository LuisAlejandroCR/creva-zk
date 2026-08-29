// api/src/backingClaim.ts
// The two numbers both backing ports share: the collateral a deployment
// holds and the strongest tier a cleared proof may claim. Free of the
// compiled circuit and of node:, so the browser-direct path reads the same
// values the in-process one does instead of restating them.

import type { Tier } from "./proofPort.js";

// The collateral the single deployment holds as witness-only private state.
// It is fixed when the contract is deployed, which is why it is a port
// option and not a per-call argument: only the requested limit — the
// circuit's public argument — varies from call to call. Synthetic demo
// data, matching the clearing case in run.ts.
export const DEFAULT_COLLATERAL_AMOUNT = 5_000n;

// backing.compact's proveBacking answers a Boolean: the collateral cleared
// the requested limit, or it did not. It has no tier ladder — that is
// backing-tier.compact's proveBackingTier, which has no TypeScript binding
// yet. So a cleared proof is reported as the LOWEST tier the proof actually
// supports. Claiming more than the circuit proved would be exactly the
// fabrication this repository exists to avoid.
export const TIER_PROVEN_BY_CLEARED_BACKING: Tier = "bronze";
