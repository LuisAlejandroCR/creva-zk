// realUnavailable.ts
// What the seam hands back for VITE_PORT_SOURCE=real. That source runs the
// circuit in-process, which needs Docker, testcontainers and node: — a
// browser has none of them, so this answers with a typed degraded result
// rather than pretending the page could ever run it.

import type { ApiResult, BackingProofPort, IdentityProofPort, Tier } from '@creva-zk/api';

function unavailable<T>(step: string): ApiResult<T> {
  return { status: 'degraded', degraded: { step, reason: 'environment_unavailable' } };
}

export function createRealBackingPort(): BackingProofPort {
  return { checkBacking: async () => unavailable<Tier>('checkBacking') };
}

export function createRealIdentityPort(): IdentityProofPort {
  return { checkIdentity: async () => unavailable<boolean>('checkIdentity') };
}
