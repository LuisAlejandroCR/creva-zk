// lacePort.ts
// Lazy adapter for the browser-direct ports. The lace path reaches
// Midnight's WebAssembly ledger, which is megabytes; a build on any other
// source must not carry it, so the module is behind a dynamic import that
// only a call on this source ever reaches, and behind a build-time flag that
// lets the bundler drop it entirely everywhere else.

import type { ApiResult, BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from '@creva-zk/api';
import type { LaceOptions } from '@creva-zk/api/lace';

// Written without optional chaining on purpose: Vite substitutes the exact
// text `import.meta.env.VITE_PORT_SOURCE` with a literal, so on every other
// source this folds to `false` at build time and the dynamic import below
// becomes unreachable code the bundler drops — chunk, WASM and all.
const LACE_BUILD = import.meta.env.VITE_PORT_SOURCE === 'lace';

async function loadLace(): Promise<typeof import('@creva-zk/api/lace')> {
  return await import('@creva-zk/api/lace');
}

// A port is contracted never to throw, and a chunk that fails to load is
// exactly the sort of external failure that contract is for.
function loadFailed<T>(step: string): ApiResult<T> {
  return { status: 'degraded', degraded: { step, reason: 'environment_unavailable' } };
}

export function createLazyLaceBackingPort(options: LaceOptions): BackingProofPort {
  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      if (!LACE_BUILD) return loadFailed<Tier>('checkBacking');
      try {
        const lace = await loadLace();
        return await lace.createLaceBackingPort(options).checkBacking(requestedLimit);
      } catch {
        return loadFailed<Tier>('checkBacking');
      }
    },
  };
}

export function createLazyLaceIdentityPort(options: LaceOptions): IdentityProofPort {
  return {
    async checkIdentity(issuerKey: JubjubPoint, expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      if (!LACE_BUILD) return loadFailed<boolean>('checkIdentity');
      try {
        const lace = await loadLace();
        return await lace.createLaceIdentityPort(options).checkIdentity(issuerKey, expectedTaxIdHash);
      } catch {
        return loadFailed<boolean>('checkIdentity');
      }
    },
  };
}
