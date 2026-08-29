// demoInputs.ts
// The synthetic public arguments the screens call each proof port with.
// Inputs only: no outcome is decided here any more — that comes back from
// the port. Every value is invented and belongs to no real person.

import type { JubjubPoint } from '@creva-zk/api';

// Stand-ins for the issuer's public key and the tax-ID hash the attestation
// is expected to match. Both are public arguments to proveIdentity: the
// document, the photo and the tax ID itself never leave the device, and
// never appear here.
export const SYNTHETIC_ISSUER_KEY: JubjubPoint = { compressed: 'ab'.repeat(32) };
export const SYNTHETIC_TAX_ID_HASH = 'cd'.repeat(32);

// The limit the demo asks for. The stub port clears anything at or under
// 3000 as "silver", which is the tier the journey has always shown.
export const SYNTHETIC_REQUESTED_LIMIT = 3_000n;

// A backing proof answers with a tier; "none" is the predicate not holding.
export function backingHolds(tier: string): boolean {
  return tier !== 'none';
}

// An identity proof answers with the predicate's own boolean.
export function identityHolds(verified: boolean): boolean {
  return verified;
}
