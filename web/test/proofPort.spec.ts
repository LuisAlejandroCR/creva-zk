// web/test/proofPort.spec.ts
// Proves the seam: swaps the stub port and the browser's real-source
// stand-in in, and renders each resulting ProofState through the same screen
// builders app.ts uses, covering every phase a proof screen can be in. The
// real port itself is Node-only now — it starts Docker and deploys — so what
// a browser build selects is src/realUnavailable.ts, and that is what is
// exercised here.

import { describe, expect, it } from 'vitest';
import { createStubBackingPort, createStubIdentityPort } from '@creva-zk/api';
import type { BackingProofPort, IdentityProofPort, JubjubPoint } from '@creva-zk/api';
import { createRealBackingPort, createRealIdentityPort } from '../src/realUnavailable';
import { toProofState } from '../src/proofPort';
import { backingHolds, identityHolds } from '../src/domain/demoInputs';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildIdentityContent } from '../src/screens/identityContent';
import { idleProof, startGenerating } from '../src/domain/proofState';

// Synthetic public arguments only — no real issuer key or tax ID anywhere
// in this test.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { compressed: 'ab'.repeat(32) };
const SYNTHETIC_TAX_ID_HASH = 'cd'.repeat(32);

async function renderBacking(port: BackingProofPort) {
  const result = await port.checkBacking(3_000n);
  return buildBackingContent(toProofState(result, backingHolds), Date.now());
}

async function renderIdentity(port: IdentityProofPort) {
  const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);
  return buildIdentityContent(toProofState(result, identityHolds), Date.now());
}

describe('proof port seam', () => {
  it('renders the backing screen ready from the stub port outcome', async () => {
    const content = await renderBacking(createStubBackingPort());
    expect(content.phase).toBe('ready');
    expect(content.ctaAction).toBe('continue');
  });

  it('renders the backing screen degraded from the real source in a browser', async () => {
    const content = await renderBacking(createRealBackingPort());
    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
  });

  it('renders the backing screen failed when the predicate does not hold', async () => {
    // Over the stub's clearing threshold: a real answer, and it is "no".
    const result = await createStubBackingPort().checkBacking(9_000n);
    const content = buildBackingContent(toProofState(result, backingHolds), Date.now());

    expect(result.status).toBe('ok');
    expect(content.phase).toBe('failed');
  });

  it('renders the identity screen ready from the stub port outcome', async () => {
    const content = await renderIdentity(createStubIdentityPort());
    expect(content.phase).toBe('ready');
    expect(content.ctaAction).toBe('continue');
  });

  it('renders the identity screen degraded from the real source in a browser', async () => {
    const content = await renderIdentity(createRealIdentityPort());
    expect(content.phase).toBe('degraded');
    expect(content.ctaAction).toBe('retry');
  });

  it('renders the identity screen failed when the predicate does not hold', () => {
    const content = buildIdentityContent(
      toProofState({ status: 'ok', value: false }, identityHolds),
      Date.now(),
    );

    expect(content.phase).toBe('failed');
  });

  it('still renders idle and generating — states no port produces but the screen must still support', () => {
    const idle = buildBackingContent(idleProof(), Date.now());
    const generating = buildBackingContent(startGenerating(Date.now()), Date.now());

    expect(idle.phase).toBe('idle');
    expect(generating.phase).toBe('generating');
  });

  it('never lets a degraded result be read as a rejection', () => {
    const degraded = buildBackingContent(
      toProofState<'silver'>({ status: 'degraded', degraded: { step: 'checkBacking', reason: 'call_failed' } }),
      Date.now(),
    );

    expect(degraded.phase).toBe('degraded');
    // Retry, never a way past an unanswered check.
    expect(degraded.ctaAction).toBe('retry');
  });
});
