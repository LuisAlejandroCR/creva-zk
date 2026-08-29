// web/test/bridgePort.spec.ts
// Proves the bridge arm of the seam: 'bridge' is a source the seam knows,
// and with the proof server down both screens settle into the degraded
// phase — "nobody could check", offering retry — rather than the failed
// phase, which would claim the predicate was evaluated and did not hold.

import { describe, expect, it, vi } from 'vitest';
import { createBridgeBackingPort, createBridgeIdentityPort } from '@creva-zk/api';
import type { JubjubPoint } from '@creva-zk/api';
import { activePortSource, identityIssuerKey, resolvePortSource, toProofState } from '../src/proofPort';
import { SYNTHETIC_ISSUER_KEY as SYNTHETIC_DEMO_ISSUER_KEY } from '../src/domain/demoInputs';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildIdentityContent } from '../src/screens/identityContent';

// Synthetic public arguments only.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { x: 1n, y: 2n };
const SYNTHETIC_TAX_ID_HASH = 'cd'.repeat(32);

// What a browser sees when nothing is listening on the bridge's port.
const serverDown = vi.fn(async () => {
  throw new TypeError('Failed to fetch');
}) as unknown as typeof fetch;

describe('proof port source selection', () => {
  it('accepts bridge and still resolves the sources that were already there', () => {
    expect(resolvePortSource('bridge')).toBe('bridge');
    expect(resolvePortSource('real')).toBe('real');
    expect(resolvePortSource('stub')).toBe('stub');
  });

  it('falls back to the stub for anything unrecognised', () => {
    expect(resolvePortSource(undefined)).toBe('stub');
    expect(resolvePortSource('')).toBe('stub');
    expect(resolvePortSource('brigde')).toBe('stub');
  });
});

describe('bridge port with the proof server down', () => {
  it('renders the backing screen degraded, offering retry', async () => {
    const port = createBridgeBackingPort({ fetchImpl: serverDown });

    const result = await port.checkBacking(3_000n);
    const content = buildBackingContent(toProofState(result), Date.now());

    expect(result.status).toBe('degraded');
    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
  });

  it('renders the identity screen degraded, offering retry', async () => {
    const port = createBridgeIdentityPort({ fetchImpl: serverDown });

    const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);
    const content = buildIdentityContent(toProofState(result), Date.now());

    expect(result.status).toBe('degraded');
    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
  });

  it('bounds the wait rather than hanging when the server accepts but never answers', async () => {
    const neverAnswers = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    const port = createBridgeBackingPort({ fetchImpl: neverAnswers, timeoutMs: 10 });

    const content = buildBackingContent(toProofState(await port.checkBacking(3_000n)), Date.now());

    expect(content.phase).toBe('degraded');
  });
});

// The acceptance criterion end to end: with the server off the identity
// screen is the degraded one at every level — port, seam, screen — and never
// an exception. And on the bridge path the browser names no issuer key at
// all: naming one is what aborted the circuit.
describe('the identity screen with the proof server off', () => {
  it('degrades on the issuer-key trip, without the call ever throwing', async () => {
    // Nothing here is wrapped in try/catch: a throw would fail this test by
    // rejecting, which is exactly the regression it guards.
    const port = createBridgeIdentityPort({ fetchImpl: serverDown });

    const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);

    expect(result.status).toBe('degraded');
    if (result.status === 'degraded') {
      expect(result.degraded.step).toBe('identityIssuerKey');
    }
  });

  it('reaches the screen as the recover archetype, reusing the copy that exists', async () => {
    const port = createBridgeIdentityPort({ fetchImpl: serverDown });

    const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);
    const content = buildIdentityContent(toProofState(result), Date.now());

    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
    // The failed screen is a different answer and must not be reached: the
    // proof was never attempted, so nothing was evaluated.
    expect(content.archetype).not.toBe('confirm');
  });

  it('degrades the same way when the server publishes no key', async () => {
    const noDeployment = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'degraded',
            degraded: { step: 'identityIssuerKey', reason: 'contract_not_found' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ) as unknown as typeof fetch;
    const port = createBridgeIdentityPort({ fetchImpl: noDeployment });

    const content = buildIdentityContent(
      toProofState(await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)),
      Date.now(),
    );

    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
  });
});

describe('which issuer key the browser names', () => {
  it('names the synthetic one only where the demo issued the attestation itself', () => {
    // The seam is resolved at module load from VITE_PORT_SOURCE, which is
    // unset here, so this is the stub path: the demo's own synthetic issuer.
    expect(activePortSource()).toBe('stub');
    expect(identityIssuerKey()).toEqual(SYNTHETIC_DEMO_ISSUER_KEY);
  });

  it('never lets a browser-named key reach a real deployment', async () => {
    // Whatever the caller passes, the bridge proves against the key the
    // server published. This is the bug the two trips exist to prevent.
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      seen.push(String(url));
      return String(url).endsWith('/proof/identity/issuer')
        ? new Response(JSON.stringify({ status: 'ok', value: { x: '77', y: '88' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : new Response(JSON.stringify({ status: 'ok', value: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    }) as unknown as typeof fetch;

    const port = createBridgeIdentityPort({ fetchImpl });
    await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);

    const proofCall = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[1]!;
    expect(JSON.parse(String(proofCall[1].body))).toEqual({
      issuerKey: { x: '77', y: '88' },
      expectedTaxIdHash: SYNTHETIC_TAX_ID_HASH,
    });
  });
});
