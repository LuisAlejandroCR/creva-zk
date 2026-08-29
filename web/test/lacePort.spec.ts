// web/test/lacePort.spec.ts
// Proves the browser-direct arm of the seam: 'lace' is a source the seam
// knows and the three it already knew still resolve, each of the four
// reasons the path can produce reaches the screens as its own degraded copy
// — never as a rejection — and the generating screen names the local proof
// server the whole privacy claim rests on.

import { describe, expect, it, vi } from 'vitest';
import type { ApiFailureReason, JubjubPoint } from '@creva-zk/api';
import { createLaceBackingPort, createLaceIdentityPort, type ConnectorHost } from '@creva-zk/api/lace';
import { activePortSource, resolvePortSource, toProofState } from '../src/proofPort';
import { verifyingLedeFor, LOCAL_PROOF_SERVER_URL } from '../src/screens/proofProvenance';
import { buildProofScreenContent, DEFAULT_VERIFYING_LEDE } from '../src/screens/proofScreen';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildIdentityContent } from '../src/screens/identityContent';
import {
  createLaceBackingPort as laceUnavailableBackingPort,
  createLaceIdentityPort as laceUnavailableIdentityPort,
} from '../src/laceUnavailable';
import { settleDegraded, settleFailed, startGenerating } from '../src/domain/proofState';
import { backingHolds, identityHolds } from '../src/domain/demoInputs';
import type { Tier } from '../src/domain/tier';

// Synthetic public arguments only.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { compressed: 'ab'.repeat(32) };
const SYNTHETIC_TAX_ID_HASH = 'cd'.repeat(32);

// The four the browser-direct preflight can tell apart.
const LACE_REASONS: readonly ApiFailureReason[] = [
  'wallet_absent',
  'wallet_locked',
  'wallet_wrong_network',
  'proof_server_unreachable',
];

describe('proof port source selection', () => {
  it('accepts lace and still resolves the three sources that were already there', () => {
    expect(resolvePortSource('lace')).toBe('lace');
    expect(resolvePortSource('bridge')).toBe('bridge');
    expect(resolvePortSource('real')).toBe('real');
    expect(resolvePortSource('stub')).toBe('stub');
  });

  it('falls back to the stub for anything unrecognised, and is unset here', () => {
    expect(resolvePortSource(undefined)).toBe('stub');
    expect(resolvePortSource('Lace')).toBe('stub');
    expect(activePortSource()).toBe('stub');
  });
});

describe('a browser-direct reason is degraded, never failed', () => {
  it.each(LACE_REASONS)('settles %s as degraded with no value', (reason) => {
    const state = toProofState<Tier>({ status: 'degraded', degraded: { step: 'checkBacking', reason } }, backingHolds);
    expect(state.phase).toBe('degraded');
    expect(state.reason).toBe(reason);
    expect(state.value).toBeUndefined();
  });

  it('never tells her the requirement is unmet when nothing was checked', () => {
    for (const reason of LACE_REASONS) {
      const content = buildBackingContent(settleDegraded<Tier>(reason), 0);
      expect(content.phase).toBe('degraded');
      expect(content.title).not.toContain('Todavía no alcanza');
      expect(content.ctaAction).toBe('retry');
      expect(content.ctaDisabled).toBe(false);
    }
  });

  it('leaves the failed screen exactly as it was — a real answer, not a malfunction', () => {
    const content = buildBackingContent(settleFailed<Tier>(), 0);
    expect(content.title).toBe('Todavía no alcanza');
  });
});

describe('each reason renders as its own screen', () => {
  it('gives every reason a distinct heading and body, on both screens', () => {
    for (const build of [
      (reason: ApiFailureReason) => buildBackingContent(settleDegraded<Tier>(reason), 0),
      (reason: ApiFailureReason) => buildIdentityContent(settleDegraded<boolean>(reason), 0),
    ]) {
      const headings = LACE_REASONS.map((reason) => build(reason).title);
      const bodies = LACE_REASONS.map((reason) => build(reason).body);
      expect(new Set(headings).size).toBe(LACE_REASONS.length);
      expect(new Set(bodies).size).toBe(LACE_REASONS.length);
    }
  });

  it('falls back to the shipped degraded copy for a reason it has nothing specific to say about', () => {
    const specific = buildBackingContent(settleDegraded<Tier>('wallet_locked'), 0);
    const generic = buildBackingContent(settleDegraded<Tier>('call_failed'), 0);
    const none = buildBackingContent(settleDegraded<Tier>(), 0);
    expect(generic.title).toBe('No pudimos terminar la revisión');
    expect(generic.body).toBe(none.body);
    expect(specific.body).not.toBe(generic.body);
  });

  it('names the local proof server, and its address, when that is what is down', () => {
    const content = buildIdentityContent(settleDegraded<boolean>('proof_server_unreachable'), 0);
    expect(content.body).toContain(LOCAL_PROOF_SERVER_URL);
    expect(content.body).toContain('Lace');
  });

  it('names Lace when the wallet is missing or locked, and the network when it is wrong', () => {
    expect(buildBackingContent(settleDegraded<Tier>('wallet_absent'), 0).body).toContain('Lace');
    expect(buildBackingContent(settleDegraded<Tier>('wallet_locked'), 0).body).toContain('Lace');
    expect(buildBackingContent(settleDegraded<Tier>('wallet_wrong_network'), 0).body).toContain('preprod');
  });
});

describe('where the proof is generated is stated, per source', () => {
  it('tells the user the lace proof comes from her own local server', () => {
    const lede = verifyingLedeFor('lace');
    expect(lede).toContain(LOCAL_PROOF_SERVER_URL);
    expect(lede).toContain('Lace');
  });

  it('leaves the other three sources on the sentence that shipped', () => {
    for (const source of ['stub', 'real', 'bridge'] as const) {
      expect(verifyingLedeFor(source)).toBe(DEFAULT_VERIFYING_LEDE);
    }
  });

  it('reaches the generating screen, which is where the 23.7s is spent', () => {
    const content = buildProofScreenContent<boolean>({
      phase: 'generating',
      now: 24_000,
      startedAt: 0,
      introTitle: 'x',
      introLede: 'y',
      verifyingTitle: 'Revisando',
      verifyingLede: verifyingLedeFor('lace'),
      startLabel: 'start',
      continueLabel: 'continue',
      stages: [{ label: 'uno', detail: 'detalle', startFraction: 0 }],
      readyTitle: () => '',
      readyLede: () => '',
      readyBody: () => '',
      failedTitle: '',
      failedBody: () => '',
      degradedBody: () => '',
      help: 'privacidad/que-ve-creva',
    });
    // The seconds live on the ring now, not in a panel heading.
    expect(content.archetype).toBe('verifying');
    expect(content.wait?.elapsedValue).toBe('24 s');
    // Past the measured run the headline takes over, so the address moves to
    // the help centre's article rather than staying on a screen that is now
    // telling her she has nothing to do.
    expect(buildProofScreenContent<boolean>({
      phase: 'generating',
      now: 11_000,
      startedAt: 0,
      introTitle: 'x',
      introLede: 'y',
      verifyingTitle: 'Revisando',
      verifyingLede: verifyingLedeFor('lace'),
      startLabel: 'start',
      continueLabel: 'continue',
      stages: [{ label: 'uno', detail: 'detalle', startFraction: 0 }],
      readyTitle: () => '',
      readyLede: () => '',
      readyBody: () => '',
      failedTitle: '',
      failedBody: () => '',
      degradedBody: () => '',
      help: 'privacidad/que-ve-creva',
    }).lede).toContain(LOCAL_PROOF_SERVER_URL);
  });

  it('keeps the default journey on the copy it always had', () => {
    expect(buildIdentityContent(startGenerating<boolean>(0), 11_000).lede).toBe(DEFAULT_VERIFYING_LEDE);
  });
});

describe('the stand-in every non-lace build gets instead', () => {
  it('answers degraded rather than throwing, like any other port', async () => {
    const backing = laceUnavailableBackingPort();
    const identity = laceUnavailableIdentityPort();
    await expect(backing.checkBacking(3_000n)).resolves.toEqual({
      status: 'degraded',
      degraded: { step: 'checkBacking', reason: 'environment_unavailable' },
    });
    await expect(identity.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).resolves.toEqual({
      status: 'degraded',
      degraded: { step: 'checkIdentity', reason: 'environment_unavailable' },
    });
  });

  it('renders as a degraded screen, never as a rejection', async () => {
    const state = toProofState(await laceUnavailableBackingPort().checkBacking(3_000n), backingHolds);
    expect(buildBackingContent(state, 0).phase).toBe('degraded');
  });
});

describe('lace ports reaching the screens', () => {
  const noWallet: ConnectorHost = {};
  const anyFetch = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;

  it('renders the backing screen with the missing-wallet copy', async () => {
    const port = createLaceBackingPort({ connectorHost: noWallet, fetchImpl: anyFetch });
    const content = buildBackingContent(toProofState(await port.checkBacking(3_000n), backingHolds), 0);
    expect(content.phase).toBe('degraded');
    expect(content.title).toBe(buildBackingContent(settleDegraded<Tier>('wallet_absent'), 0).title);
  });

  it('renders the identity screen with the missing-wallet copy', async () => {
    const port = createLaceIdentityPort({ connectorHost: noWallet, fetchImpl: anyFetch });
    const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);
    const content = buildIdentityContent(toProofState(result, identityHolds), 0);
    expect(content.phase).toBe('degraded');
    expect(content.title).toBe(buildIdentityContent(settleDegraded<boolean>('wallet_absent'), 0).title);
  });
});
