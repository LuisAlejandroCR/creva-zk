// web/src/proofPort.ts
// The seam: the single place web/ selects which @creva-zk/api proof-port
// implementation backs a screen, plus the adapter turning a port's
// ApiResult into the ProofState the screens already render. The source is
// chosen at build time by VITE_PORT_SOURCE, so switching between the stub
// and a real proof needs no code edit — see the note below.

import type { ApiResult, BackingProofPort, IdentityProofPort } from '@creva-zk/api';
import { createRealBackingPort, createRealIdentityPort, createStubBackingPort, createStubIdentityPort } from '@creva-zk/api';
import type { ProofState } from './domain/proofState';
import { settleFailed, settleReady } from './domain/proofState';

type PortSource = 'stub' | 'real';

// 'stub' by default so a clone, a test run and every screen render stay
// instant. Set VITE_PORT_SOURCE=real to drive the screens from an actual
// proof: correct, but ~23.7s per call against the local network, which is
// why it is opt-in rather than the default.
//
//   VITE_PORT_SOURCE=real npm run dev --workspace web
//
// Anything other than 'real' falls back to the stub, so a typo degrades to
// the safe side instead of silently blocking every screen for half a minute.
const PORT_SOURCE: PortSource =
  import.meta.env?.VITE_PORT_SOURCE === 'real' ? 'real' : 'stub';

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
