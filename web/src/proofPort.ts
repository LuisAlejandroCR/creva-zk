// web/src/proofPort.ts
// The seam: the single place web/ selects which @creva-zk/api proof-port
// implementation backs a screen, plus the adapter turning a port's
// ApiResult into the ProofState the screens already render. Flipping
// PORT_SOURCE to 'real' below is the one-line swap once api/'s call path
// is finished — nothing else in web/ has to change.

import type { ApiResult, BackingProofPort, IdentityProofPort } from '@creva-zk/api';
import { createRealBackingPort, createRealIdentityPort, createStubBackingPort, createStubIdentityPort } from '@creva-zk/api';
import type { ProofState } from './domain/proofState';
import { settleFailed, settleReady } from './domain/proofState';

const PORT_SOURCE: 'stub' | 'real' = 'stub';

export function selectBackingPort(): BackingProofPort {
  return PORT_SOURCE === 'real' ? createRealBackingPort() : createStubBackingPort();
}

export function selectIdentityPort(): IdentityProofPort {
  return PORT_SOURCE === 'real' ? createRealIdentityPort() : createStubIdentityPort();
}

// A port's ApiResult has no "degraded but here's a lower-trust value" case
// the way this app's own demo scenarios do — degraded means no value came
// back at all, so it renders as the same "failed, offer retry" state as a
// hard failure.
export function toProofState<T>(result: ApiResult<T>): ProofState<T> {
  return result.status === 'ok' ? settleReady(result.value) : settleFailed<T>();
}
