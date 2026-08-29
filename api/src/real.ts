// api/src/real.ts
// Node-only entry point, for the in-process real proof path. Kept out of
// index.ts on purpose: this one reaches Docker, testcontainers and node:
// modules, so bundling it into a browser is not a size problem but an
// impossibility.

export {
  createRealBackingPort,
  shutdownRealPorts,
  DEFAULT_COLLATERAL_AMOUNT,
  TIER_PROVEN_BY_CLEARED_BACKING,
  type RealPortOptions,
} from "./realProofPort.js";

export {
  createRealIdentityPort,
  realIdentityIssuerKey,
  shutdownIdentityPort,
  DEFAULT_TAX_ID_HEX,
  type RealIdentityPortOptions,
} from "./realIdentityPort.js";
