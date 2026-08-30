// signerEntropy.ts
// The randomness and digest seam the Schnorr signer draws on, so one signer
// runs unchanged in Node and in a browser. Web Crypto is the only source
// here on purpose: `node:crypto` does not exist in a page, and importing it
// took the whole browser-direct stack down with an error that named the
// wallet instead of the import.

// The two primitives the signer needs from its host. Injectable so a caller
// can supply a deterministic pair in a test, and so neither one is ever
// reached for through a `typeof window` check scattered across the signer.
export interface SignerEntropy {
  /** Uniformly random bytes; the secret key is drawn from these. */
  randomBytes(length: number): Uint8Array;
  /** SHA-512 over the given bytes. Async because Web Crypto's digest is. */
  sha512(input: Uint8Array): Promise<Uint8Array>;
}

// Structural, rather than the DOM's `Crypto` or Node's `webcrypto.Crypto`:
// this workspace is typechecked against Node's lib and consumed by a bundle
// typechecked against the DOM's, and only these two members are used.
interface WebCryptoLike {
  getRandomValues<T extends Uint8Array>(array: T): T;
  subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
}

// Node has had `globalThis.crypto` since 19 and this repository requires 24,
// so the same expression resolves on both sides. A host that has neither is
// told exactly what is missing rather than failing later inside a digest.
function webCrypto(): WebCryptoLike {
  const source = (globalThis as { crypto?: unknown }).crypto as WebCryptoLike | undefined;
  if (source === undefined || typeof source.getRandomValues !== "function" || source.subtle === undefined) {
    throw new Error(
      "the attestation signer needs Web Crypto (globalThis.crypto.getRandomValues and .subtle); " +
        "in a browser that means a secure context — https or localhost",
    );
  }
  return source;
}

// The default seam. Browsers reach it through `window.crypto`, Node through
// its own global of the same name; neither path imports `node:crypto`.
export const webCryptoEntropy: SignerEntropy = {
  randomBytes(length: number): Uint8Array {
    return webCrypto().getRandomValues(new Uint8Array(length));
  },
  async sha512(input: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await webCrypto().subtle.digest("SHA-512", input));
  },
};
