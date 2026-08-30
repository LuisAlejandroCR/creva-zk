// attestation/test/signerEntropy.test.ts
// The signer has to run in a browser. That means two things, and both are
// checked here: nothing on this path imports `node:crypto` (the import that
// took the whole Lace stack down and surfaced as "Cartera bloqueada"), and a
// signature produced with randomness drawn from globalThis.crypto verifies
// against the same equation the circuit checks.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  SchnorrAttestationSigner,
  verifyAttestationSignature,
  webCryptoEntropy,
  type SignerEntropy,
} from "../src/signing.js";
import type { SignedPayload } from "../src/types.js";
import type { IdentityClaim } from "../src/identity/types.js";
import { identityChallenge } from "./support/contractHasher.js";

const SOURCE_DIR = fileURLToPath(new URL("../src", import.meta.url));

function everySourceFile(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) everySourceFile(path, found);
    else if (path.endsWith(".ts")) found.push(path);
  }
  return found;
}

describe("nothing on the signing path reaches for a Node built-in", () => {
  it("imports no node: module anywhere in attestation/src", () => {
    const offenders = everySourceFile(SOURCE_DIR).filter((path) =>
      // The import statement itself, not a mention in a comment: a comment
      // explaining why `node:crypto` is absent must not fail this.
      /(?:^|\n)\s*(?:import|export)[^;\n]*from\s+["']node:/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

// A synthetic claim and subject. Nothing here belongs to a real person.
const claim: IdentityClaim = { verified: true, ofAge: true, taxId: "cd".repeat(32) };
const payload: SignedPayload<IdentityClaim> = { subjectKey: { x: 0n, y: 1n }, claim };

describe("the browser seam produces a signature the circuit's equation accepts", () => {
  it("signs with a key drawn from globalThis.crypto.getRandomValues", async () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues");

    // No secret key supplied: the signer has to draw one through the seam.
    const signer = new SchnorrAttestationSigner<IdentityClaim>(identityChallenge, undefined, webCryptoEntropy);
    const signature = await signer.sign(payload);

    expect(getRandomValues).toHaveBeenCalled();
    expect(verifyAttestationSignature(identityChallenge, payload, signature, signer.publicKey)).toBe(true);
    getRandomValues.mockRestore();
  });

  it("digests the nonce through the seam's SHA-512, not a Node hash", async () => {
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest");

    const signer = new SchnorrAttestationSigner<IdentityClaim>(identityChallenge, 4242n, webCryptoEntropy);
    const signature = await signer.sign(payload);

    expect(digest).toHaveBeenCalled();
    expect(verifyAttestationSignature(identityChallenge, payload, signature, signer.publicKey)).toBe(true);
    digest.mockRestore();
  });

  it("uses only getRandomValues and subtle.digest, so a page with no node: still signs", async () => {
    // Stands in for a browser: the two Web Crypto members and nothing else.
    const browserOnly: SignerEntropy = {
      randomBytes: (length) => globalThis.crypto.getRandomValues(new Uint8Array(length)),
      sha512: async (input) => new Uint8Array(await globalThis.crypto.subtle.digest("SHA-512", input)),
    };

    const signer = new SchnorrAttestationSigner<IdentityClaim>(identityChallenge, undefined, browserOnly);
    const signature = await signer.sign(payload);

    expect(verifyAttestationSignature(identityChallenge, payload, signature, signer.publicKey)).toBe(true);
  });

  it("still signs deterministically once the key is fixed", async () => {
    const signer = new SchnorrAttestationSigner<IdentityClaim>(identityChallenge, 99n, webCryptoEntropy);
    expect(await signer.sign(payload)).toEqual(await signer.sign(payload));
  });

  it("rejects a signature checked against another issuer's key", async () => {
    const signer = new SchnorrAttestationSigner<IdentityClaim>(identityChallenge, 7n, webCryptoEntropy);
    const stranger = new SchnorrAttestationSigner<IdentityClaim>(identityChallenge, 8n, webCryptoEntropy);

    const signature = await signer.sign(payload);

    expect(verifyAttestationSignature(identityChallenge, payload, signature, stranger.publicKey)).toBe(false);
  });
});

describe("a host without Web Crypto is told what is missing", () => {
  it("names getRandomValues and subtle rather than failing inside a digest", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      expect(() => webCryptoEntropy.randomBytes(8)).toThrow(/Web Crypto/);
    } finally {
      if (original !== undefined) Object.defineProperty(globalThis, "crypto", original);
    }
  });
});
