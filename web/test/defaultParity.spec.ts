// defaultParity.spec.ts
// Criterion 2, pinned: with VITE_PORT_SOURCE unset the journey must select
// the stub ports and touch no network. The strings below are the copy the
// default path ships, written out literally so that changing it fails here
// rather than surprising anyone on stage.

import { describe, expect, it } from 'vitest';
import { createStubBackingPort, createStubIdentityPort } from '@creva-zk/api';
import type { Tier } from '../src/domain/tier';
import { STUB_LATENCY_MS, idleProof, startGenerating } from '../src/domain/proofState';
import { MEASURED_PROOF_MS } from '../src/domain/waitStages';
import { activePortSource, resolvePortSource, selectBackingPort, selectIdentityPort, toProofState } from '../src/proofPort';
import { runProof } from '../src/proofRun';
import {
  SYNTHETIC_ISSUER_KEY,
  SYNTHETIC_REQUESTED_LIMIT,
  SYNTHETIC_TAX_ID_HASH,
  backingHolds,
  identityHolds,
} from '../src/domain/demoInputs';
import { buildIdentityContent } from '../src/screens/identityContent';
import { buildBackingContent } from '../src/screens/backingContent';
import { buildOffersContent } from '../src/screens/offersContent';

const noSleep = async (): Promise<void> => {};

describe('with VITE_PORT_SOURCE unset', () => {
  it('selects the stub source', () => {
    // Nothing is set in the test environment, which is the unset case.
    expect(resolvePortSource(import.meta.env?.VITE_PORT_SOURCE)).toBe('stub');
    expect(activePortSource()).toBe('stub');
  });

  it('selects the stub ports, so no network is touched', async () => {
    // Same outcomes as the ports the seam hands back with nothing set.
    await expect(selectIdentityPort().checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).resolves.toEqual(
      await createStubIdentityPort().checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH),
    );
    await expect(selectBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT)).resolves.toEqual(
      await createStubBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT),
    );
  });

  // The stub answers instantly, so the hold is what the wait screen is paced
  // against. It is the measured latency of one real proof and nothing else:
  // an invented hold would stage a story the real thing never tells.
  it('holds the wait screen for exactly the measured proof latency', () => {
    expect(STUB_LATENCY_MS).toBe(MEASURED_PROOF_MS);
    expect(MEASURED_PROOF_MS).toBe(23_700);
  });
});

describe('the default journey renders the copy it always did', () => {
  it('identity: idle', () => {
    const content = buildIdentityContent(idleProof<boolean>(), 0);
    expect(content.h1).toBe('Solicita tu tarjeta');
    expect(content.statusHeading).toBe('Aún no empezamos');
    expect(content.statusBody).toBe(
      'Cuando toques el botón, tu teléfono empieza a revisar tu identificación. Tarda unos 24 segundos y no envía nada.',
    );
    expect(content.ctaLabel).toBe('Solicita la tarjeta');
    expect(content.ctaDisabled).toBe(false);
  });

  it('identity: generating, staged rather than spun', () => {
    const content = buildIdentityContent(startGenerating<boolean>(0), 11_000);
    expect(content.statusHeading).toBe('Trabajando en tu solicitud');
    expect(content.ctaLabel).toBe('Trabajando en tu teléfono…');
    expect(content.ctaDisabled).toBe(true);
    expect(content.wait?.elapsedLabel).toBe('11 s de unos 24 s');
    expect(content.wait?.stages).toHaveLength(4);
  });

  it('identity: ready, from the stub port', async () => {
    const settled = await runProof<boolean>({
      call: () => selectIdentityPort().checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH),
      holds: identityHolds,
      emit: () => {},
      sleep: noSleep,
    });
    const content = buildIdentityContent(settled, 0);

    expect(content.phase).toBe('ready');
    expect(content.statusHeading).toBe('✓ Listo, eres tú');
    expect(content.ctaLabel).toBe('Ver a qué califico');
  });

  it('backing: ready at Plata, from the stub port', async () => {
    const settled = await runProof<Tier>({
      call: () => selectBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT),
      holds: backingHolds,
      emit: () => {},
      sleep: noSleep,
    });
    const content = buildBackingContent(settled, 0);

    expect(content.phase).toBe('ready');
    expect(settled.value).toBe('silver');
    expect(content.h1).toBe('Descubre a qué calificas');
    expect(content.statusHeading).toBe('✓ Calificas en nivel Plata');
    expect(content.ctaLabel).toBe('Ver qué compartí');
  });

  it('offers: the same proven tier the journey always ended on', async () => {
    const settled = toProofState(
      await selectBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT),
      backingHolds,
    );
    const content = buildOffersContent(settled.value ?? 'none');

    expect(content.tierLabel).toBe('Plata');
    expect(content.h1).toBe('Tu resultado');
  });

  it('never reaches a failure state on the default path', async () => {
    const identity = toProofState(
      await selectIdentityPort().checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH),
      identityHolds,
    );
    const backing = toProofState(
      await selectBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT),
      backingHolds,
    );

    expect(identity.phase).toBe('ready');
    expect(backing.phase).toBe('ready');
  });
});
