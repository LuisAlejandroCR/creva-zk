// api/src/identityIssuerKey.ts
// The one encoding the issuer's Jubjub key travels in outside the runtime:
// "x:y", both coordinates in decimal. Parsing and formatting live together
// so the operator tool that prints a key and the build that reads one back
// can never disagree about the format.
//
// DECIMAL (x, y), NEVER A COMPRESSED POINT. Nothing in this repository can
// decompress a curve point, so a hex string would be a value nobody could
// turn back into the pair `proveIdentity` takes.

import type { JubjubPoint } from "./proofPort.js";

/** What separates the two coordinates. */
export const ISSUER_KEY_SEPARATOR = ":";

// Non-negative decimal, no sign, no 0x, no exponent, no spaces inside. A
// field element is a plain natural number and anything else is a typo the
// build should be told about rather than silently coerced.
const DECIMAL = /^[0-9]+$/;

// "x:y", both decimal. This is the exact string the operator copies off the
// deployment screen and pastes into VITE_IDENTITY_ISSUER_KEY.
export function formatIssuerKey(key: JubjubPoint): string {
  return `${key.x.toString(10)}${ISSUER_KEY_SEPARATOR}${key.y.toString(10)}`;
}

// Undefined rather than a throw for anything malformed: a build variable is
// read on a path contracted never to throw, and "the build named no usable
// key" is the same precondition as "the build named no key at all".
//
// The point is NOT checked against the curve here. The circuit is the
// authority on that: a key that is not on the curve makes verifyAttestation
// abort, which is already a distinguishable, honest outcome.
export function parseIssuerKey(raw: string | undefined): JubjubPoint | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.trim().split(ISSUER_KEY_SEPARATOR);
  if (parts.length !== 2) return undefined;
  const [x, y] = parts as [string, string];
  const trimmedX = x.trim();
  const trimmedY = y.trim();
  if (!DECIMAL.test(trimmedX) || !DECIMAL.test(trimmedY)) return undefined;
  return { x: BigInt(trimmedX), y: BigInt(trimmedY) };
}
