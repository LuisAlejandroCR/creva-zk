// journeyProgress.spec.ts
// The step indicator: one compact treatment that says where she is, and one
// sentence for anyone who cannot see the track. The flow used to print the
// same fact twice — "Paso 2 de 4 · Tu respaldo" above "1 listo · te faltan 3"
// — and this is what replaced it.

import { describe, expect, it } from 'vitest';
import { buildStepProgress } from '../../src/domain/journeyProgress';

describe('buildStepProgress', () => {
  it('says where she is in as few words as it can', () => {
    expect(buildStepProgress(2, 4, 'Tu respaldo').counter).toBe('2 de 4');
  });

  it('names the step after what it is about, never after the mechanism', () => {
    const progress = buildStepProgress(2, 4, 'Tu respaldo');
    expect(progress.name).toBe('Tu respaldo');
    // The whole sentence exists for a screen reader, which cannot see the
    // track the sighted reader glances at.
    expect(progress.label).toBe('Paso 2 de 4: Tu respaldo');
  });

  it('draws one mark per step, so what is behind her is shown and not counted out', () => {
    expect(buildStepProgress(1, 4, 'x').marks).toEqual(['current', 'ahead', 'ahead', 'ahead']);
    expect(buildStepProgress(3, 4, 'x').marks).toEqual(['done', 'done', 'current', 'ahead']);
    expect(buildStepProgress(4, 4, 'x').marks).toEqual(['done', 'done', 'done', 'current']);
  });

  it('marks exactly one step as the current one, at any length', () => {
    for (const total of [2, 4, 6]) {
      for (let step = 1; step <= total; step += 1) {
        const marks = buildStepProgress(step, total, 'x').marks;
        expect(marks).toHaveLength(total);
        expect(marks.filter((mark) => mark === 'current')).toHaveLength(1);
      }
    }
  });
});
