// identityStore.spec.ts
// The identity path's private-state store password. It has to survive a
// reload — the attestation the operator's deployment wrote is what a later
// proof reads back — and it has to satisfy the provider's own password
// policy, which is checked here with the provider's own validator rather
// than a copy of its rules — validatePassword throws on a password it
// refuses, so "does not throw" is what accepted means.

import { describe, expect, it } from 'vitest';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';
import {
  generateStorePassword,
  identityStorePassword,
  IDENTITY_STORE_PASSWORD_KEY,
  type PasswordStorage,
} from '../src/identityStore';

// Deterministic stand-in for getRandomValues: the password's shape is what
// matters here, not its entropy.
function fill(value: number): (bytes: Uint8Array) => void {
  return (bytes) => bytes.fill(value);
}

function memoryStorage(initial: Record<string, string> = {}): PasswordStorage & { readonly data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('the generated password satisfies the provider policy', () => {
  for (const seed of [0, 7, 61, 200, 255]) {
    it(`is accepted by validatePassword for a draw of ${seed}`, () => {
      expect(() => validatePassword(generateStorePassword(fill(seed)))).not.toThrow();
    });
  }
});

describe('the password survives a reload', () => {
  it('keeps the first password and returns it again', () => {
    const storage = memoryStorage();
    const first = identityStorePassword(storage, fill(3));
    const second = identityStorePassword(storage, fill(200));
    expect(second).toBe(first);
  });

  it('stores it under its own key, so nothing else collides with it', () => {
    const storage = memoryStorage();
    const password = identityStorePassword(storage, fill(3));
    expect(storage.data[IDENTITY_STORE_PASSWORD_KEY]).toBe(password);
  });

  it('generates a new one only when nothing is kept', () => {
    expect(identityStorePassword(memoryStorage(), fill(1))).not.toBe(
      identityStorePassword(memoryStorage(), fill(2)),
    );
  });

  it('reuses a value already in storage rather than overwriting it', () => {
    const kept = generateStorePassword(fill(9));
    const storage = memoryStorage({ [IDENTITY_STORE_PASSWORD_KEY]: kept });
    expect(identityStorePassword(storage, fill(1))).toBe(kept);
  });
});

describe('a browser that refuses storage still gets a usable password', () => {
  it('falls back when there is no storage at all', () => {
    expect(() => validatePassword(identityStorePassword(undefined, fill(4)))).not.toThrow();
  });

  it('falls back when reading throws', () => {
    const throwing: PasswordStorage = {
      getItem: () => {
        throw new Error('storage is blocked in this context');
      },
      setItem: () => undefined,
    };
    expect(() => validatePassword(identityStorePassword(throwing, fill(4)))).not.toThrow();
  });

  it('falls back when writing throws', () => {
    const throwing: PasswordStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => validatePassword(identityStorePassword(throwing, fill(4)))).not.toThrow();
  });

  it('treats an empty stored value as nothing kept', () => {
    const storage = memoryStorage({ [IDENTITY_STORE_PASSWORD_KEY]: '' });
    expect(identityStorePassword(storage, fill(5)).length).toBeGreaterThan(0);
  });
});
