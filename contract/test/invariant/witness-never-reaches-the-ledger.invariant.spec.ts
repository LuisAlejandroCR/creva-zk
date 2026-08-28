// witness-never-reaches-the-ledger.invariant.spec.ts
// The promise: nothing a witness returns ever lands on a ledger field
// undisclosed, and the identity predicate's ledger is limited to a bare
// call counter — never the subject key, the claim, or the outcome — so
// there is never a public record of a verification event.
//
// This is a source-level static check, not a circuit execution, because
// this sandbox has no `compact` binary (see the task's environment note).

import { describe, expect, it } from "vitest";
import { assertLedgerAssignmentsAreDisclosed, readCompactSource } from "../support/circuitSpec.js";

describe("backing-tier.compact", () => {
  const source = readCompactSource("backing-tier.compact");

  it("only ever assigns disclose()'d values or bare literals to its ledger fields", () => {
    expect(() => assertLedgerAssignmentsAreDisclosed(source, ["tier", "answered"], "backing-tier")).not.toThrow();
  });

  it("never assigns the raw collateral claim to a ledger field", () => {
    expect(source).not.toMatch(/^\s*(tier|answered)\s*=\s*collateral/m);
    expect(source).not.toMatch(/^\s*(tier|answered)\s*=\s*att\.payload\.claim/m);
  });

  it("catches an injected leak: a bare witness assignment must fail the check", () => {
    const leaky = source.replace("tier = outcome;", "tier = collateral;");
    expect(() => assertLedgerAssignmentsAreDisclosed(leaky, ["tier", "answered"], "backing-tier")).toThrow(
      /neither disclose/,
    );
  });
});

describe("identity-check.compact", () => {
  const source = readCompactSource("identity-check.compact");

  it("exposes only a bare call counter — no subject key, claim, or outcome", () => {
    const ledgerFields = [...source.matchAll(/export ledger (\w+):/g)].map((m) => m[1]);
    expect(ledgerFields).toEqual(["answered"]);
  });

  it("never assigns anything witness-derived to that counter", () => {
    expect(source).toMatch(/^\s*answered\.increment\(1\);\s*$/m);
    expect(source).not.toMatch(/^\s*answered\s*=/m);
  });
});

describe("Attestation.compact", () => {
  const source = readCompactSource("Attestation.compact");

  it("the shared primitive itself declares no ledger — it is a pure module", () => {
    expect(source).not.toMatch(/export ledger/);
  });
});
