// proofProvenance.ts
// One "generating" body per proof-port source, saying where the proof is
// actually being generated. The browser-direct path names the user's own
// local proof server on purpose: that the proof never leaves this machine is
// the whole privacy claim, so the screen states it rather than implying it.

import type { PortSource } from '../proofPort';
import { DEFAULT_GENERATING_BODY } from './proofScreen';

// The address Lace's own "Ajustes » Midnight » Local" setting uses.
export const LOCAL_PROOF_SERVER_URL = 'http://localhost:6300';

// Every source but the browser-direct one proves on this machine through a
// process the app itself started, which is what the default sentence already
// says — so those three share it, byte for byte. Only the browser-direct
// path names a server the user configured, and it names the address too:
// someone watching a stalled proof needs the number in front of her.
const GENERATING_BODY: Readonly<Record<PortSource, string>> = {
  stub: DEFAULT_GENERATING_BODY,
  real: DEFAULT_GENERATING_BODY,
  bridge: DEFAULT_GENERATING_BODY,
  lace: `Todo se hace en el servidor que configuraste en Lace (Ajustes » Midnight » Local, ${LOCAL_PROOF_SERVER_URL}): corre en esta computadora, nunca en la de alguien más. Tarda unos 24 segundos. No cierres esta pantalla.`,
};

export function generatingBodyFor(source: PortSource): string {
  return GENERATING_BODY[source];
}
