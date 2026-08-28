// web/src/proofPort.ts
// The seam: the single place web/ selects which @creva-zk/api proof-port
// implementation backs a screen, plus the adapter turning a port's
// ApiResult into the ProofState the screens already render. The source is
// chosen at build time by VITE_PORT_SOURCE, so switching between the stub
// and a real proof needs no code edit — see the note below.

import type { ApiResult, BackingProofPort, IdentityProofPort } from '@creva-zk/api';
import {
  createBridgeBackingPort,
  createBridgeIdentityPort,
  createRealBackingPort,
  createRealIdentityPort,
  createStubBackingPort,
  createStubIdentityPort,
} from '@creva-zk/api';
import type { ProofState } from './domain/proofState';
import { settleFailed, settleReady } from './domain/proofState';

type PortSource = 'stub' | 'real' | 'bridge';

// 'stub' by default so a clone, a test run and every screen render stay
// instant. Two opt-ins drive the screens from an actual proof instead:
//
//   VITE_PORT_SOURCE=real   the in-process port — Node only, so this is for
//                           a Node caller, not for the browser.
//   VITE_PORT_SOURCE=bridge the browser-safe port: it fetches the local
//                           proof server in api/ (`npm run serve --workspace
//                           api`), which owns the Node-only call path and
//                           the exclusive private-state lock.
//
//   VITE_PORT_SOURCE=bridge npm run dev --workspace web
//
// Either way a call costs ~23.7s against the local network, which is why
// they are opt-in rather than the default. Anything unrecognised falls back
// to the stub, so a typo degrades to the safe side instead of silently
// blocking every screen for half a minute.
export function resolvePortSource(raw: string | undefined): PortSource {
  if (raw === 'real') return 'real';
  if (raw === 'bridge') return 'bridge';
  return 'stub';
}

const PORT_SOURCE: PortSource = resolvePortSource(import.meta.env?.VITE_PORT_SOURCE);

// Where the bridge port looks for that server. Left undefined unless the
// build sets it, so @creva-zk/api's own default (http://localhost:8787)
// applies.
const BRIDGE_OPTIONS = { baseUrl: import.meta.env?.VITE_BRIDGE_URL } as const;

export function selectBackingPort(): BackingProofPort {
  switch (PORT_SOURCE) {
    case 'real':
      return createRealBackingPort();
    case 'bridge':
      return createBridgeBackingPort(BRIDGE_OPTIONS);
    default:
      return createStubBackingPort();
  }
}

export function selectIdentityPort(): IdentityProofPort {
  switch (PORT_SOURCE) {
    case 'real':
      return createRealIdentityPort();
    case 'bridge':
      return createBridgeIdentityPort(BRIDGE_OPTIONS);
    default:
      return createStubIdentityPort();
  }
}

// A port's ApiResult has no "degraded but here's a lower-trust value" case
// the way this app's own demo scenarios do — degraded means no value came
// back at all, so it renders as the same "failed, offer retry" state as a
// hard failure.
export function toProofState<T>(result: ApiResult<T>): ProofState<T> {
  return result.status === 'ok' ? settleReady(result.value) : settleFailed<T>();
}
