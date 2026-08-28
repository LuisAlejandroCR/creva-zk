// web/test/proofPort.spec.ts
// Proves the seam: swaps the stub and real @creva-zk/api ports in and
// renders each resulting ProofState through the same screen builders
// app.ts uses, covering every phase a proof screen can be in.

import { describe, expect, it } from 'vitest';
import { createRealBackingPort, createRealIdentityPort, createStubBackingPort, createStubIdentityPort } from '@creva-zk/api';
import type { BackingProofPort, IdentityProofPort, JubjubPoint } from '@creva-zk/api';
import { toProofState } from '../src/proofPort';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildIdentityContent } from '../src/screens/identityContent';
import { idleProof, settleDegraded, startGenerating } from '../src/domain/proofState';

// Synthetic public arguments only — no real issuer key or tax ID anywhere
// in this test.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { compressed: 'ab'.repeat(32) };
const SYNTHETIC_TAX_ID_HASH = 'cd'.repeat(32);

async function renderBacking(port: BackingProofPort) {
  const result = await port.checkBacking(3_000n);
  return buildBackingContent(toProofState(result), Date.now());
}

async function renderIdentity(port: IdentityProofPort) {
  const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);
  return buildIdentityContent(toProofState(result), Date.now());
}

describe('proof port seam', () => {
  it('renders the backing screen ready from the stub port outcome', async () => {
    const content = await renderBacking(createStubBackingPort());
    expect(content.phase).toBe('ready');
    expect(content.ctaAction).toBe('continue');
  });

  it('renders the backing screen failed from the real port (unfinished, always degrades)', async () => {
    const content = await renderBacking(createRealBackingPort());
    expect(content.phase).toBe('failed');
    expect(content.ctaAction).toBe('retry');
  });

  it('renders the identity screen ready from the stub port outcome', async () => {
    const content = await renderIdentity(createStubIdentityPort());
    expect(content.phase).toBe('ready');
    expect(content.ctaAction).toBe('continue');
  });

  it('renders the identity screen failed from the real port (unfinished, always degrades)', async () => {
    const content = await renderIdentity(createRealIdentityPort());
    expect(content.phase).toBe('failed');
    expect(content.ctaAction).toBe('retry');
  });

  it('still renders idle, generating and degraded — states no port produces but the screen must still support', () => {
    const idle = buildBackingContent(idleProof(), Date.now());
    const generating = buildBackingContent(startGenerating(Date.now()), Date.now());
    const degraded = buildBackingContent(settleDegraded('bronze'), Date.now());

    expect(idle.phase).toBe('idle');
    expect(generating.phase).toBe('generating');
    expect(degraded.phase).toBe('degraded');
    expect(degraded.ctaAction).toBe('continue-anyway');
  });
});
