// deployOptions.ts
// The build-time options the operator deployment runs with. Separate from
// the seam in proofPort.ts on purpose: that one configures the journey's
// proofs, this one configures a tool the journey never reaches. It reads the
// same network id and artifact base URL, so a deployment is made against
// exactly the setup the app will later prove against, and deliberately does
// NOT read VITE_BACKING_CONTRACT_ADDRESS — an address is what it produces.

import type { LaceDeployOptions } from '@creva-zk/api/lace';

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
      error: (obj, msg) => console.error(`[creva-zk] ${msg}`, obj),
    },
  };
}
