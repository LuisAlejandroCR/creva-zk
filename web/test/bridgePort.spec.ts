// web/test/bridgePort.spec.ts
// Proves the bridge arm of the seam: 'bridge' is a source the seam knows,
// and with the proof server down both screens settle into the degraded
// phase — "nobody could check", offering retry — rather than the failed
// phase, which would claim the predicate was evaluated and did not hold.

import { describe, expect, it, vi } from 'vitest';
import { createBridgeBackingPort, createBridgeIdentityPort } from '@creva-zk/api';
import type { JubjubPoint } from '@creva-zk/api';
import { resolvePortSource, toProofState } from '../src/proofPort';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildIdentityContent } from '../src/screens/identityContent';

// Synthetic public arguments only.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { compressed: 'ab'.repeat(32) };
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
