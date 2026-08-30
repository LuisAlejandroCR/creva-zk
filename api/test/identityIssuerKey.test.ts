// api/test/identityIssuerKey.test.ts
// Pins the one encoding the issuer key travels in outside the runtime:
// "x:y", both coordinates in decimal. A round trip through format and parse
// has to give back the same point, and everything that is not that shape —
// hex, a compressed point, one coordinate, a sign — has to come back as
// "no key", never as a wrong one.

import { describe, expect, it } from "vitest";
import { formatIssuerKey, parseIssuerKey, ISSUER_KEY_SEPARATOR } from "../src/identityIssuerKey.js";
import type { JubjubPoint } from "../src/proofPort.js";

// Synthetic: two large decimals that stand in for a curve point. No real
// issuer key is in this repository.
const SYNTHETIC_KEY: JubjubPoint = {
  x: 28336281903124990867587793011069573392383982287722241916350956173377953689573n,
  y: 39385640392217313770878525135509063452020585410343666726093009378539878503883n,
};

describe("the issuer key travels as decimal (x, y)", () => {
  it("formats as x:y with both coordinates in decimal", () => {
    expect(formatIssuerKey(SYNTHETIC_KEY)).toBe(
      `${SYNTHETIC_KEY.x.toString(10)}${ISSUER_KEY_SEPARATOR}${SYNTHETIC_KEY.y.toString(10)}`,
    );
  });

  it("round-trips a point through the string the build variable takes", () => {
    expect(parseIssuerKey(formatIssuerKey(SYNTHETIC_KEY))).toEqual(SYNTHETIC_KEY);
  });

  it("carries no hex anywhere, so nothing ever has to decompress a point", () => {
    const formatted = formatIssuerKey(SYNTHETIC_KEY);
    expect(formatted).toMatch(/^[0-9]+:[0-9]+$/);
  });

  it("tolerates surrounding whitespace, which a paste often carries", () => {
    expect(parseIssuerKey(`  ${formatIssuerKey(SYNTHETIC_KEY)}  `)).toEqual(SYNTHETIC_KEY);
  });

  it("reads the zero point rather than treating it as absent", () => {
    expect(parseIssuerKey("0:0")).toEqual({ x: 0n, y: 0n });
  });
});

describe("anything that is not that shape is no key at all", () => {
  const rejected = [
    ["nothing at all", undefined],
    ["an empty string", ""],
    ["a compressed point in hex", "ab".repeat(32)],
    ["hex coordinates", "0xab:0xcd"],
    ["one coordinate", "123"],
    ["three coordinates", "1:2:3"],
    ["a negative coordinate", "-1:2"],
    ["a decimal fraction", "1.5:2"],
    ["a coordinate that is not a number", "x:y"],
    ["an empty coordinate", "1:"],
  ] as const;

  for (const [label, raw] of rejected) {
    it(`treats ${label} as absent`, () => {
      expect(parseIssuerKey(raw)).toBeUndefined();
    });
  }
});
