// defaultParity.spec.ts
// Criterion 2, pinned: with VITE_PORT_SOURCE unset the journey must behave
// exactly as it did before the screens were wired to the seam. The strings
// below are the copy that shipped, written out literally so that changing
// the default path fails here rather than surprising anyone on stage.

import { describe, expect, it } from 'vitest';
import { createStubBackingPort, createStubIdentityPort } from '@creva-zk/api';
import type { Tier } from '../src/domain/tier';
import { STUB_LATENCY_MS, idleProof, startGenerating } from '../src/domain/proofState';
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

  it('keeps the generating screen on for the same 32s it always was', () => {
    expect(STUB_LATENCY_MS).toBe(32_000);
  });
});

describe('the default journey renders the copy it always did', () => {
  it('identity: idle', () => {
    const content = buildIdentityContent(idleProof<boolean>(), 0);
    expect(content.h1).toBe('Solicita la tarjeta');
    expect(content.statusHeading).toBe('Sin iniciar');
    expect(content.statusBody).toBe('Presiona iniciar para generar esta prueba. Todavía no se envía nada.');
    expect(content.ctaLabel).toBe('Iniciar prueba');
    expect(content.ctaDisabled).toBe(false);
  });

  it('identity: generating, with the elapsed readout', () => {
    const content = buildIdentityContent(startGenerating<boolean>(0), 11_000);
    expect(content.statusHeading).toBe('Generando tu prueba… 11 s transcurridos');
    expect(content.ctaLabel).toBe('Generando…');
    expect(content.ctaDisabled).toBe(true);
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
    expect(content.statusHeading).toBe('✓ Identidad verificada');
    expect(content.ctaLabel).toBe('Continuar');
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
    expect(content.statusHeading).toBe('✓ Prueba de respaldo lista — Plata');
    expect(content.ctaLabel).toBe('Continuar');
  });

  it('offers: the same proven tier the journey always ended on', async () => {
    const settled = toProofState(
      await selectBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT),
      backingHolds,
    );
    const content = buildOffersContent(settled.value ?? 'none');

    expect(content.tierLabel).toBe('Plata');
    expect(content.h1).toBe('Lo que podrías calificar');
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
