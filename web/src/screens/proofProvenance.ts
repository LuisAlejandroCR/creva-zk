// proofProvenance.ts
// One "generating" body per proof-port source, saying where the proof is
// actually being generated. The browser-direct path names the user's own
// local proof server on purpose: that the proof never leaves this machine is
// the whole privacy claim, so the screen states it rather than implying it.

import type { PortSource } from '../proofPort';
import { DEFAULT_GENERATING_BODY } from './proofScreen';

// The address Lace's own "Ajustes » Midnight » Local" setting uses. Written
// into the copy rather than linked, because a user watching a stalled proof
// needs the number in front of her.
export const LOCAL_PROOF_SERVER_URL = 'http://localhost:6300';

// Every source but the browser-direct one proves on this machine through a
// process the app itself started, which is exactly what the shipped sentence
// already said — so the default path's copy is unchanged, byte for byte.
const GENERATING_BODY: Readonly<Record<PortSource, string>> = {
  stub: DEFAULT_GENERATING_BODY,
  real: DEFAULT_GENERATING_BODY,
  bridge: DEFAULT_GENERATING_BODY,
  lace: `Se genera en el servidor local que configuraste en Lace (Ajustes » Midnight » Local, ${LOCAL_PROOF_SERVER_URL}): corre en esta computadora, nunca en un servicio remoto, y ahí está toda la promesa de privacidad de este producto. Toma decenas de segundos — se verifica una atestación firmada y se evalúa un predicado, sin revelar los datos subyacentes.`,
};

export function generatingBodyFor(source: PortSource): string {
  return GENERATING_BODY[source];
}
