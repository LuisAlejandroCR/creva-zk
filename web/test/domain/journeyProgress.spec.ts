// journeyProgress.spec.ts
// The progress tally: on every step she is told what is behind her and what
// is left, in her own words, without having to count the screens herself.

import { describe, expect, it } from 'vitest';
import { buildStepProgress } from '../../src/domain/journeyProgress';

describe('buildStepProgress', () => {
  it('names the step after what it is about, never after the mechanism', () => {
    expect(buildStepProgress(2, 4, 'Tu respaldo').label).toBe('Paso 2 de 4 · Tu respaldo');
  });

  it('says what is done and what is left on every step', () => {
    expect(buildStepProgress(1, 4, 'x').tally).toBe('Son 4 pasos · te faltan 4');
    expect(buildStepProgress(2, 4, 'x').tally).toBe('1 listo · te faltan 3');
    expect(buildStepProgress(3, 4, 'x').tally).toBe('2 listos · te faltan 2');
    expect(buildStepProgress(4, 4, 'x').tally).toBe('3 listos · te falta 1');
  });

  it('never opens on "0 listos", which counts her achievements at zero', () => {
    expect(buildStepProgress(1, 4, 'x').tally).not.toContain('0 listo');
  });

  it('agrees in number, singular and plural alike', () => {
    expect(buildStepProgress(2, 2, 'x').tally).toBe('1 listo · te falta 1');
    expect(buildStepProgress(4, 6, 'x').tally).toBe('3 listos · te faltan 3');
  });
});
