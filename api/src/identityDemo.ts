// api/src/identityDemo.ts
// The one synthetic tax-ID hash both sides of the identity predicate use.
// Browser-safe on purpose: the deployment's claim and the value the screen
// asks about must be the SAME 32 bytes, or the circuit answers "does not
// match" — a true answer to the wrong question.

// Invented, not a hash of anything: no real RFC is involved and none can be
// recovered from it. Shared so a change here moves both sides at once.
export const DEMO_TAX_ID_HEX = "cd".repeat(32);
