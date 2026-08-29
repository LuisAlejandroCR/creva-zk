// waitStages.spec.ts
// The wait screen's sequence, tested without waiting for it: which stage is
// live at a given moment, how the meter fills, and what happens when a proof
// outlasts the measured run.

import { describe, expect, it } from 'vitest';
import {
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

describe('buildWaitProgress', () => {
  it('shows every stage from the first millisecond, so the wait has a shape', () => {
    const progress = buildWaitProgress(STAGES, 0);
    expect(progress.stages).toHaveLength(STAGES.length);
    expect(progress.stages.map((s) => s.status)).toEqual(['active', 'pending', 'pending', 'pending']);
  });

  it('advances one stage at a time, marking the ones behind as done', () => {
    const progress = buildWaitProgress(STAGES, MEASURED_PROOF_MS * 0.6);
    expect(progress.activeIndex).toBe(2);
    expect(progress.stages.map((s) => s.status)).toEqual(['done', 'done', 'active', 'pending']);
    expect(progress.headline).toBe('tres');
    expect(progress.detail).toBe('detalle tres');
  });

  it('fills the meter in step with the elapsed time, never to the brim', () => {
    expect(buildWaitProgress(STAGES, 0).percent).toBe(0);
    expect(buildWaitProgress(STAGES, MEASURED_PROOF_MS / 2).percent).toBe(48);
    expect(buildWaitProgress(STAGES, MEASURED_PROOF_MS).percent).toBeLessThan(100);
  });

  it('reads the elapsed time against the measured run, in plain words', () => {
    expect(buildWaitProgress(STAGES, 11_000).elapsedLabel).toBe('11 s de unos 24 s');
  });

  it('holds on the last stage past the measured run instead of claiming it finished', () => {
    const progress = buildWaitProgress(STAGES, MEASURED_PROOF_MS + 9_000);
    expect(progress.overtime).toBe(true);
    expect(progress.activeIndex).toBe(STAGES.length - 1);
    expect(progress.stages.at(-1)?.status).toBe('active');
    expect(progress.percent).toBeLessThan(100);
    expect(progress.elapsedLabel).toContain('ya casi');
  });

  it('treats a clock that ran backwards as zero rather than a negative wait', () => {
    const progress = buildWaitProgress(STAGES, -5_000);
    expect(progress.percent).toBe(0);
    expect(progress.activeIndex).toBe(0);
    expect(progress.elapsedLabel).toBe('0 s de unos 24 s');
  });

  it('refuses an empty sequence, which would render as a spinner', () => {
    expect(() => buildWaitProgress([], 0)).toThrow();
  });
});
