// waitStages.spec.ts
// The wait screen's sequence, tested without waiting for it: which single
// stage is on screen at a given moment, the beat a finished stage holds its
// check for, how the ring advances, and what happens past the measured run.

import { describe, expect, it } from 'vitest';
import {
  CELEBRATION_MS,
  MEASURED_PROOF_MS,
  buildWaitProgress,
  type WaitStage,
} from '../../src/domain/waitStages';

const STAGES: readonly WaitStage[] = [
  { label: 'uno', detail: 'detalle uno', startFraction: 0 },
  { label: 'dos', detail: 'detalle dos', startFraction: 0.25 },
  { label: 'tres', detail: 'detalle tres', startFraction: 0.5 },
  { label: 'cuatro', detail: 'detalle cuatro', startFraction: 0.75 },
];

// A moment comfortably clear of any stage boundary, so no held beat is in
// play and the step on screen is simply the one running.
const settledInto = (index: number): number =>
  STAGES[index]!.startFraction * MEASURED_PROOF_MS + CELEBRATION_MS + 1;

describe('buildWaitProgress', () => {
  it('opens on the first stage, alone and running', () => {
    const progress = buildWaitProgress(STAGES, 0);
    expect(progress.current.index).toBe(0);
    expect(progress.current.label).toBe('uno');
    expect(progress.current.status).toBe('active');
    expect(progress.celebrating).toBe(false);
    expect(progress.totalStages).toBe(STAGES.length);
  });

  it('advances one stage at a time', () => {
    const progress = buildWaitProgress(STAGES, settledInto(2));
    expect(progress.activeIndex).toBe(2);
    expect(progress.current.index).toBe(2);
    expect(progress.current.status).toBe('active');
    expect(progress.headline).toBe('tres');
    expect(progress.detail).toBe('detalle tres');
  });

  it('fills the meter in step with the elapsed time, never to the brim', () => {
    expect(buildWaitProgress(STAGES, 0).percent).toBe(0);
    expect(buildWaitProgress(STAGES, MEASURED_PROOF_MS / 2).percent).toBe(48);
    expect(buildWaitProgress(STAGES, MEASURED_PROOF_MS).percent).toBeLessThan(100);
  });

  // "11 s de unos 24 s" was precision the app cannot promise on a source
  // whose latency it does not control. Elapsed time is a fact; the estimate
  // it used to be measured against was not.
  it('reports elapsed time as a fact, and claims no estimate around it', () => {
    const progress = buildWaitProgress(STAGES, 11_000);
    expect(progress.elapsedValue).toBe('11 s');
    expect(progress.elapsedLabel).toBe('Llevamos 11 s');
    expect(progress.elapsedLabel).not.toMatch(/de unos/);
  });

  it('holds on the last stage past the measured run instead of claiming it finished', () => {
    const progress = buildWaitProgress(STAGES, MEASURED_PROOF_MS + 9_000);
    expect(progress.overtime).toBe(true);
    expect(progress.activeIndex).toBe(STAGES.length - 1);
    expect(progress.stages.at(-1)?.status).toBe('active');
    expect(progress.percent).toBeLessThan(100);
    // Overtime is said by the headline the screen swaps in, not by dressing
    // the number up: the readout keeps reporting the one thing it knows.
    expect(progress.elapsedLabel).toBe('Llevamos 32 s');
  });

  it('treats a clock that ran backwards as zero rather than a negative wait', () => {
    const progress = buildWaitProgress(STAGES, -5_000);
    expect(progress.percent).toBe(0);
    expect(progress.activeIndex).toBe(0);
    expect(progress.elapsedLabel).toBe('Llevamos 0 s');
  });

  it('refuses an empty sequence, which would render as a spinner', () => {
    expect(() => buildWaitProgress([], 0)).toThrow();
  });
});

describe('the finished stage holds its check for a beat', () => {
  const boundary = STAGES[1]!.startFraction * MEASURED_PROOF_MS;

  it('keeps the stage that just finished on screen, checked, when its successor starts', () => {
    const progress = buildWaitProgress(STAGES, boundary + 10);
    expect(progress.celebrating).toBe(true);
    // The step running is already the next one…
    expect(progress.activeIndex).toBe(1);
    // …but what she sees is the one she just finished, wearing its check.
    expect(progress.current.index).toBe(0);
    expect(progress.current.label).toBe('uno');
    expect(progress.current.status).toBe('done');
  });

  it('holds it for the whole beat and not a millisecond longer', () => {
    const nearlyOver = buildWaitProgress(STAGES, boundary + CELEBRATION_MS - 1);
    expect(nearlyOver.celebrating).toBe(true);
    expect(nearlyOver.current.index).toBe(0);

    const over = buildWaitProgress(STAGES, boundary + CELEBRATION_MS);
    expect(over.celebrating).toBe(false);
    expect(over.current.index).toBe(1);
    expect(over.current.status).toBe('active');
  });

  it('never celebrates before the first stage has a predecessor to celebrate', () => {
    expect(buildWaitProgress(STAGES, 0).celebrating).toBe(false);
    expect(buildWaitProgress(STAGES, 10).celebrating).toBe(false);
  });

  it('leaves the beat short enough that two never overlap', () => {
    for (let i = 1; i < STAGES.length; i += 1) {
      const span = (STAGES[i]!.startFraction - STAGES[i - 1]!.startFraction) * MEASURED_PROOF_MS;
      expect(span, `stage ${i - 1} is shorter than the beat`).toBeGreaterThan(CELEBRATION_MS);
    }
  });
});

describe('never a stage marked done before it is', () => {
  // Walk the whole run at the tick rate the app actually renders at.
  const TICK_MS = 200;

  it('marks a stage done only once its successor has started', () => {
    for (let elapsed = 0; elapsed <= MEASURED_PROOF_MS + 12_000; elapsed += TICK_MS) {
      const progress = buildWaitProgress(STAGES, elapsed);

      progress.stages.forEach((stage, index) => {
        if (stage.status !== 'done') return;
        const successorStart = STAGES[index + 1]?.startFraction ?? Infinity;
        expect(
          elapsed,
          `stage ${index} shown done at ${elapsed}ms, before its successor started`,
        ).toBeGreaterThanOrEqual(successorStart * MEASURED_PROOF_MS);
      });

      // And exactly one stage is ever the one on screen.
      expect(progress.current.index).toBeGreaterThanOrEqual(0);
      expect(progress.current.index).toBeLessThan(STAGES.length);
    }
  });

  it('never marks the last stage done, because the answer has not arrived', () => {
    for (let elapsed = 0; elapsed <= MEASURED_PROOF_MS + 20_000; elapsed += TICK_MS) {
      const progress = buildWaitProgress(STAGES, elapsed);
      expect(progress.stages.at(-1)?.status, `last stage done at ${elapsed}ms`).not.toBe('done');
      expect(progress.percent).toBeLessThan(100);
    }
  });

  it('advances the displayed stage monotonically, never backwards', () => {
    let previous = -1;
    for (let elapsed = 0; elapsed <= MEASURED_PROOF_MS + 12_000; elapsed += TICK_MS) {
      const index = buildWaitProgress(STAGES, elapsed).current.index;
      expect(index, `went backwards at ${elapsed}ms`).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });
});
