// identityBuildWiring.spec.ts
// Criterion 6, pinned: the two new build variables change nothing until they
// are set. A build that names neither carries no identity address and no
// issuer key, so the browser-direct identity port joins nothing; the backing
// options are untouched; and the bridge path — the one that is recorded —
// still names no browser-side issuer key at all.

import { describe, expect, it } from 'vitest';
import { buildIdentityLaceOptions, identityIssuerKey, resolvePortSource } from '../src/proofPort';
import { SYNTHETIC_ISSUER_KEY } from '../src/domain/demoInputs';
import { IDENTITY_STORE_PASSWORD_KEY } from '../src/identityStore';

// What the backing path already put in the options object. Nothing below may
// remove or rewrite any of it.
const BASE = {
  contractAddress: 'ab'.repeat(32),
  expectedNetworkId: 'preprod',
  zkConfigBaseUrl: '/zk',
} as const;

describe('with neither variable set nothing is pointed at a deployment', () => {
  it('carries no identity address and no issuer key', () => {
    const options = buildIdentityLaceOptions(undefined, BASE);
    expect(options.identityContractAddress).toBeUndefined();
    expect(options.identityIssuerKey).toBeUndefined();
  });

  it('carries neither when the environment simply has no such keys', () => {
    const options = buildIdentityLaceOptions({}, BASE);
    expect(options.identityContractAddress).toBeUndefined();
    expect(options.identityIssuerKey).toBeUndefined();
  });

  it('leaves everything the backing path configured exactly as it was', () => {
    const options = buildIdentityLaceOptions(undefined, BASE);
    expect(options.contractAddress).toBe(BASE.contractAddress);
    expect(options.expectedNetworkId).toBe(BASE.expectedNetworkId);
    expect(options.zkConfigBaseUrl).toBe(BASE.zkConfigBaseUrl);
  });

  it('is the unset case in this test run, so nothing here is set by accident', () => {
    expect(import.meta.env?.VITE_IDENTITY_CONTRACT_ADDRESS).toBeUndefined();
    expect(import.meta.env?.VITE_IDENTITY_ISSUER_KEY).toBeUndefined();
    expect(resolvePortSource(import.meta.env?.VITE_PORT_SOURCE)).toBe('stub');
  });
});

describe('with both variables set the port is pointed at that deployment', () => {
  const options = buildIdentityLaceOptions(
    {
      VITE_IDENTITY_CONTRACT_ADDRESS: 'cd'.repeat(32),
      // Synthetic: two small decimals in the documented "x:y" form.
      VITE_IDENTITY_ISSUER_KEY: '11:22',
    },
    BASE,
  );

  it('reads the address the operator pasted', () => {
    expect(options.identityContractAddress).toBe('cd'.repeat(32));
  });

  it('reads the issuer key as the (x, y) pair the circuit takes', () => {
    expect(options.identityIssuerKey).toEqual({ x: 11n, y: 22n });
  });
});

describe('a malformed issuer key is treated as absent, never as a wrong key', () => {
  const cases = ['ab'.repeat(32), '0xab:0xcd', '1', '1:2:3', ''];

  for (const raw of cases) {
    it(`ignores ${JSON.stringify(raw)}`, () => {
      const options = buildIdentityLaceOptions(
        { VITE_IDENTITY_CONTRACT_ADDRESS: 'cd'.repeat(32), VITE_IDENTITY_ISSUER_KEY: raw },
        BASE,
      );
      expect(options.identityIssuerKey).toBeUndefined();
    });
  }
});

describe('the recorded bridge path is untouched', () => {
  it('still names no browser-side issuer key on the bridge source', () => {
    // The seam's own rule, unchanged: the server publishes the key its
    // deployment signs under, and the browser sends the zero-point marker.
    expect(resolvePortSource('bridge')).toBe('bridge');
    // The active source in this run is the stub, which still proves against
    // the synthetic demo issuer exactly as before.
    expect(identityIssuerKey()).toEqual(SYNTHETIC_ISSUER_KEY);
  });

  it('keeps the identity store password under a key of its own', () => {
    // Named here so a rename that would silently orphan a deployed
    // attestation fails a test instead.
    expect(IDENTITY_STORE_PASSWORD_KEY).toBe('creva-zk.identity-store-password.v1');
  });
});
