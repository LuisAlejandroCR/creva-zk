// proofProvenance.ts
// One line per proof-port source, saying where the proof is actually being
// generated. It is the verification screen's lede, so it stays short; the
// browser-direct path names the user's own local proof server on purpose,
// because that the proof never leaves this machine is the whole privacy
// claim, and someone watching a stalled proof needs the address in front of
// her.

import type { PortSource } from '../proofPort';
import { DEFAULT_VERIFYING_LEDE } from './proofScreen';

// The address Lace's own "Ajustes » Midnight » Local" setting uses.
export const LOCAL_PROOF_SERVER_URL = 'http://localhost:6300';

// Every source but the browser-direct one proves on this machine through a
// process the app itself started, which is what the default sentence already
// says — so those three share it, byte for byte.
const VERIFYING_LEDE: Readonly<Record<PortSource, string>> = {
  stub: DEFAULT_VERIFYING_LEDE,
  real: DEFAULT_VERIFYING_LEDE,
  bridge: DEFAULT_VERIFYING_LEDE,
  lace: `Todo se hace en el servidor que configuraste en Lace (${LOCAL_PROOF_SERVER_URL}): corre en esta computadora, nunca en la de alguien más. No cierres esta pantalla.`,
};

export function verifyingLedeFor(source: PortSource): string {
  return VERIFYING_LEDE[source];
}
