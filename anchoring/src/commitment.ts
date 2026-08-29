// anchoring/src/commitment.ts
// Builds and opens the hiding commitment that is the only thing this system
// ever puts on an external chain. Exists to keep the blinding factor and the
// domain separation in one place, where the hiding property can be audited.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { BackingOutcome, Commitment } from "./types.js";

// Domain-separates this hash from every other use of sha256 in the system,
// so a commitment computed here can never collide with one computed
// elsewhere for an unrelated purpose.
const DOMAIN = Buffer.from("creva-zk:backing:v1", "utf8");

// A random, off-chain secret mixed into every commitment. Without it, the
// hash of {tier, timestamp} has almost no entropy — tier is a handful of
// values and timestamp is guessable to the minute, so an observer of the
// anchored hash could brute-force both in milliseconds. The blinding factor
// is what makes the commitment actually hide the outcome; only the holder
// who kept it can later open the commitment to an auditor.
export interface Blinding {
  readonly hex: string; // 32 random bytes, hex
}

export interface CommitmentWithBlinding {
  readonly commitment: Commitment;
  readonly blinding: Blinding;
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer, got ${value}`);
  }
}

// Fixed-width big-endian encoding, not string interpolation: two integers
// concatenated as decimal text are ambiguous (tier=1,timestamp=23 hashes
// the same bytes as tier=12,timestamp=3), and a NaN or float would silently
// produce a different digest instead of failing loudly.
function beBytes(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(value));
  return buf;
}

function digest(outcome: BackingOutcome, blindingHex: string): string {
  return createHash("sha256")
    .update(DOMAIN)
    .update(beBytes(outcome.tier))
    .update(beBytes(outcome.timestamp))
    .update(Buffer.from(blindingHex, "hex"))
    .digest("hex");
}

// The only constructor of a Commitment. Its input type is BackingOutcome —
// there is no sibling function that takes an identity outcome, so an
// identity result has no way to become anchorable.
export function commitBackingOutcome(outcome: BackingOutcome): CommitmentWithBlinding {
  assertNonNegativeSafeInteger(outcome.tier, "tier");
  assertNonNegativeSafeInteger(outcome.timestamp, "timestamp");

  const blinding: Blinding = { hex: randomBytes(32).toString("hex") };
  return { commitment: { hex: digest(outcome, blinding.hex) }, blinding };
}

// Lets the holder open a previously anchored commitment to an auditor: given
// the outcome and the blinding factor kept off-chain, recompute the digest
// and compare it against the on-chain commitment.
export function verifyBackingCommitment(
  outcome: BackingOutcome,
  blinding: Blinding,
  commitment: Commitment,
): boolean {
  assertNonNegativeSafeInteger(outcome.tier, "tier");
  assertNonNegativeSafeInteger(outcome.timestamp, "timestamp");

  const expected = Buffer.from(digest(outcome, blinding.hex), "hex");
  const actual = Buffer.from(commitment.hex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
