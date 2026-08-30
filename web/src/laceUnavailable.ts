// laceUnavailable.ts
// Build-time stand-in for @creva-zk/api/lace on every source that is not
// 'lace'. Rollup walks a dynamic import's module graph before it eliminates
// the dead branch around it, so without this alias a stub build would still
// emit 11 MB of the ledger's WebAssembly that nothing references.

import type { ApiResult, BackingProofPort, IdentityProofPort, Tier } from '@creva-zk/api';
import type { LaceDeployment } from '@creva-zk/api/lace';

// Unreachable at runtime: the seam only asks for a lace port when
// VITE_PORT_SOURCE is 'lace', which is the same condition that swaps this
// module out. It still answers with a typed degraded result rather than
// throwing, because that is what a port is contracted to do.
function unavailable<T>(step: string): ApiResult<T> {
  return { status: 'degraded', degraded: { step, reason: 'environment_unavailable' } };
}

export function createLaceBackingPort(): BackingProofPort {
  return { checkBacking: async () => unavailable<Tier>('checkBacking') };
}

export function createLaceIdentityPort(): IdentityProofPort {
  return { checkIdentity: async () => unavailable<boolean>('checkIdentity') };
}

// The operator deployment stands in the same way, and for the same reason:
// on any source but 'lace' there is no ledger in the bundle to deploy with.
export async function deployBackingWithLace(): Promise<ApiResult<LaceDeployment>> {
  return unavailable<LaceDeployment>('deployBacking');
}
