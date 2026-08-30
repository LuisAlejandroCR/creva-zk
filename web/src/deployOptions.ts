// deployOptions.ts
// The build-time options the operator deployments run with. Separate from
// the seam in proofPort.ts on purpose: that one configures the journey's
// proofs, this one configures a tool the journey never reaches. It reads the
// same network id and artifact base URL, so a deployment is made against
// exactly the setup the app will later prove against, and deliberately does
// NOT read VITE_BACKING_CONTRACT_ADDRESS — an address is what it produces.

import type { LaceDeployOptions, LaceIdentityDeployOptions } from '@creva-zk/api/lace';
import { causeChain } from './causeChain';
import { identityStorePasswordProvider } from './identityStore';

export function laceDeployOptions(): LaceDeployOptions {
  return {
    ...(import.meta.env?.VITE_LACE_NETWORK_ID === undefined
      ? {}
      : { expectedNetworkId: import.meta.env.VITE_LACE_NETWORK_ID }),
    ...(import.meta.env?.VITE_ZK_CONFIG_URL === undefined
      ? {}
      : { zkConfigBaseUrl: import.meta.env.VITE_ZK_CONFIG_URL }),
    // The same console logger the journey's ports use: the network id the
    // wallet reports and every raw provider error behind a degraded reason
    // go here, never into the screen.
    logger: {
      info: (obj, msg) => console.info(`[creva-zk] ${msg}`, obj),
      // The SDK wraps a provider's real failure in its own error and puts the
      // original on `cause`. Console collapses that, so the chain is walked
      // and printed flat — the wrapper alone names the circuit and hides why.
      error: (obj, msg) => console.error(`[creva-zk] ${msg}`, obj, ...causeChain(obj)),
    },
  };
}

// The identity deployment's options. Everything the backing one uses, plus
// the one thing that deployment cannot do without: a private-state store
// password that survives a reload.
//
// The identity circuit reads a signed attestation as witness-only private
// state, and only the issuer that signed it can produce one. This deployment
// writes that attestation; the journey build reads it back on a later page
// load, from this same browser and this same wallet. A password generated per
// load would leave it undecryptable and the proof with nothing to run on.
// See identityStore.ts.
export function laceIdentityDeployOptions(): LaceIdentityDeployOptions {
  return {
    ...laceDeployOptions(),
    privateStoragePasswordProvider: identityStorePasswordProvider(),
  };
}
