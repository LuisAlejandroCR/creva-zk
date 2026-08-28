import { createHash } from "node:crypto";
import type { BackingOutcome, Commitment } from "./types.js";

// The only constructor of a Commitment. Its input type is BackingOutcome —
// there is no sibling function that takes an identity outcome, so an
// identity result has no way to become anchorable.
export function commitBackingOutcome(outcome: BackingOutcome): Commitment {
  const canonical = `{"tier":${outcome.tier},"timestamp":${outcome.timestamp}}`;
  const hex = createHash("sha256").update(canonical, "utf8").digest("hex");
  return { hex };
}
