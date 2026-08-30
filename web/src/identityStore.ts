// identityStore.ts
// The password the browser-direct IDENTITY path locks its private-state store
// with, kept in localStorage so it survives a reload. The backing path keeps
// its per-load ephemeral password and is untouched by this file.
//
// Why it has to survive: the identity circuit reads a signed attestation as
// witness-only private state, and only the issuer that signed it can produce
// one. The operator's deployment writes that attestation; a later proof reads
// it back. A password generated per page load would make the store
// undecryptable on the next load, and the proof would have nothing to run on.

/** Where the generated password is kept. Bumped if the format ever changes. */
export const IDENTITY_STORE_PASSWORD_KEY = 'creva-zk.identity-store-password.v1';

// The one localStorage shape this module needs, so a test can pass a plain
// object and a browser that refuses storage (private mode, blocked cookies)
// can be handled rather than throwing.
export interface PasswordStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Satisfies levelPrivateStateProvider's password policy by construction — 31
// characters, four character classes, and a separator every three characters
// so no ascending run of four can form. Deliberately NOT imported from
// @creva-zk/api/lace's ephemeralStoragePassword, which is in the chunk that
// carries Midnight's WebAssembly ledger: reaching for it here would pull
// megabytes into a module the page loads eagerly.
export function generateStorePassword(random: (bytes: Uint8Array) => void): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(24);
  random(bytes);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length] ?? 'x');
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 3) {
    groups.push(chars.slice(i, i + 3).join(''));
  }
  // The literal tail guarantees an upper, a lower, a digit and a special
  // character regardless of what the random draw produced.
  return `${groups.join('-')}-Az9!`;
}

// Reads the stored password, generating and keeping one the first time. A
// storage that throws (private mode) or refuses to keep the value still gets
// a usable password — this run simply cannot hand it to the next one, which
// is the same position the backing path is in permanently.
export function identityStorePassword(
  storage: PasswordStorage | undefined,
  random: (bytes: Uint8Array) => void,
): string {
  let existing: string | null = null;
  try {
    existing = storage?.getItem(IDENTITY_STORE_PASSWORD_KEY) ?? null;
  } catch {
    existing = null;
  }
  if (existing !== null && existing !== '') return existing;

  const generated = generateStorePassword(random);
  try {
    storage?.setItem(IDENTITY_STORE_PASSWORD_KEY, generated);
  } catch {
    // Nothing to do: the password is still good for this page load.
  }
  return generated;
}

// What the ports and the operator tool actually pass to the provider. Bound
// to the page's own localStorage and Web Crypto, and read lazily so no module
// touches storage at import time.
export function identityStorePasswordProvider(): () => string {
  return () =>
    identityStorePassword(
      // A browser that has no localStorage at all, and a test runner without
      // a DOM, both land on undefined rather than a ReferenceError.
      typeof localStorage === 'undefined' ? undefined : localStorage,
      (bytes) => globalThis.crypto.getRandomValues(bytes),
    );
}
