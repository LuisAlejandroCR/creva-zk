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
      // The SDK wraps a provider's real failure in its own error and puts the
      // original on `cause`. Console collapses that, so the chain is walked
      // and printed flat — the wrapper alone names the circuit and hides why.
      error: (obj, msg) => console.error(`[creva-zk] ${msg}`, obj, ...causeChain(obj)),
    },
  };
}

// Every `cause` under a thrown error, flattened into arguments the console
// prints instead of eliding. Bounded so a self-referential chain cannot spin.
function causeChain(obj: unknown): unknown[] {
  const out: unknown[] = [];
  let current: unknown = (obj as { err?: unknown })?.err;
  for (let depth = 0; depth < 6 && current !== undefined && current !== null; depth += 1) {
    const cause = (current as { cause?: unknown }).cause;
    if (cause === undefined || cause === null) break;
    out.push(`cause[${depth}]:`, cause);
    current = cause;
  }
  return out;
}
