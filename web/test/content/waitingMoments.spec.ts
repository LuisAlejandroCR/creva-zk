// waitingMoments.spec.ts
// The rules the waiting moments obey to ship: every one of them is cued
// inside a processing period rather than after a step, the journey states one
// figure in total, that figure names its source, and no moment promises an
// offer the product cannot make.

import { describe, expect, it } from 'vitest';
import {
  MOMENT_CUES,
  PROGRESS_MOMENTS,
  cuesFor,
  momentByOrder,
  type ProgressMoment,
} from '../../src/content/waitingMoments';

// A figure is a number the copy states. The popover is one sentence, so the
// sentence is what is scanned. Non-breaking spaces normalise first.
const FIGURE = /\d+(?:[.,]\d+)?\s?%/;
const plain = (text: string): string => text.replace(/ /g, ' ');
const hasFigure = (moment: ProgressMoment): boolean => FIGURE.test(plain(moment.body));

describe('the moments are well formed', () => {
  it('runs the arc in order and hands nothing back past its end', () => {
    expect(PROGRESS_MOMENTS.map((moment) => moment.order)).toEqual([1, 2, 3, 4]);
    for (const order of [1, 2, 3, 4]) expect(momentByOrder(order)).toBeDefined();
    expect(momentByOrder(5)).toBeUndefined();
  });

  it('keeps every title to two to four words', () => {
    for (const moment of PROGRESS_MOMENTS) {
      const words = moment.title.trim().split(/\s+/).length;
      expect(words, `${moment.order}: "${moment.title}" is ${words} words`).toBeGreaterThanOrEqual(2);
      expect(words, `${moment.order}: "${moment.title}" is ${words} words`).toBeLessThanOrEqual(4);
    }
  });

  it('keeps every body to one sentence short enough for a caption', () => {
    for (const moment of PROGRESS_MOMENTS) {
      // The terminator has to be followed by a space or the end of the
      // string, so the decimal point in "42.3 %" is not counted as a sentence.
      const sentences = [...plain(moment.body).matchAll(/[.!?](\s|$)/g)].length;
      expect(sentences, `${moment.order} body has ${sentences} sentences`).toBeLessThanOrEqual(1);
      expect(moment.body.length, `${moment.order} body too long`).toBeLessThanOrEqual(100);
      expect(moment.eyebrow.length, `${moment.order} eyebrow too long`).toBeLessThanOrEqual(18);
    }
  });

  it('gives every moment its own visual and its own emotional purpose', () => {
    expect(PROGRESS_MOMENTS.map((moment) => moment.variant)).toEqual([
      'discovery',
      'encouragement',
      'structural',
      'celebration',
    ]);
    // Four distinct pictures: the arc must not read as the same popup four
    // times over.
    expect(new Set(PROGRESS_MOMENTS.map((moment) => moment.visual)).size).toBe(4);
  });
});

// The heart of this rework: the moment belongs to the wait, not to the step.
describe('every moment is cued by processing, never by a tap', () => {
  it('gives every moment in the arc exactly one cue', () => {
    expect(MOMENT_CUES.map((cue) => cue.order).sort()).toEqual([1, 2, 3, 4]);
    for (const cue of MOMENT_CUES) expect(momentByOrder(cue.order)).toBeDefined();
  });

  it('hangs every cue off one of the two waits the journey actually has', () => {
    for (const cue of MOMENT_CUES) expect(['identity', 'backing']).toContain(cue.wait);
  });

  it('opens each wait with a moment rather than closing a step with one', () => {
    expect(cuesFor('identity', 'processing').map((cue) => cue.order)).toEqual([1, 2]);
    expect(cuesFor('backing', 'processing').map((cue) => cue.order)).toEqual([3]);
  });

  it('reserves the settled cue for the celebration alone', () => {
    const settled = MOMENT_CUES.filter((cue) => cue.phase === 'settled');
    expect(settled).toHaveLength(1);
    // Saying "listo" while a bar still reads 81 % would be the one lie this
    // journey has always refused, so the closing moment waits for the answer.
    expect(momentByOrder(settled[0]!.order)!.variant).toBe('celebration');
  });

  it('spaces the cues inside a wait far enough apart to be read separately', () => {
    for (const wait of ['identity', 'backing'] as const) {
      const cues = cuesFor(wait, 'processing');
      for (let i = 1; i < cues.length; i += 1) {
        expect(cues[i]!.afterMs - cues[i - 1]!.afterMs).toBeGreaterThanOrEqual(5_000);
      }
    }
  });

  it('cues nothing so late that a proof of the measured length would miss it', () => {
    // The measured run is 23.7s. A cue past it would only ever be dropped.
    for (const cue of MOMENT_CUES) expect(cue.afterMs).toBeLessThan(20_000);
  });
});

describe('the cadence', () => {
  it('states exactly one figure across the whole onboarding', () => {
    const withFigures = PROGRESS_MOMENTS.filter(hasFigure);
    expect(
      withFigures.length,
      `moments ${withFigures.map((m) => m.order).join(', ')} state a figure`,
    ).toBe(1);
  });

  it('puts that figure first and never two in a row', () => {
    expect(hasFigure(momentByOrder(1)!)).toBe(true);
    for (let i = 1; i < PROGRESS_MOMENTS.length; i += 1) {
      expect(hasFigure(PROGRESS_MOMENTS[i - 1]!) && hasFigure(PROGRESS_MOMENTS[i]!)).toBe(false);
    }
  });

  it('ends on a celebration rather than on a statistic', () => {
    const last = PROGRESS_MOMENTS.at(-1)!;
    expect(last.variant).toBe('celebration');
    expect(hasFigure(last)).toBe(false);
  });
});

describe('the structural moment shows progress, not a shortfall', () => {
  const structural = momentByOrder(3)!;

  it('is the only moment that shows where she is in the journey', () => {
    expect(structural.showsChecklist).toBe(true);
    expect(PROGRESS_MOMENTS.filter((moment) => moment.showsChecklist)).toHaveLength(1);
  });

  it('never frames the remaining work as something she failed to hand over', () => {
    const copy = [structural.eyebrow, structural.title, structural.body].join(' ');
    expect(copy).not.toMatch(/no entregaste|falta(n)? tus|incompleto|pendiente de tu parte/i);
    expect(copy.toLowerCase()).toContain('casi listo');
  });

  it('carries no figure, because it needs none', () => {
    expect(hasFigure(structural)).toBe(false);
    expect(structural.source).toBeUndefined();
  });
});

describe('every figure names its source', () => {
  it.each(PROGRESS_MOMENTS.map((moment) => [moment.order, moment] as const))(
    'moment %i',
    (_order, moment) => {
      if (hasFigure(moment)) {
        expect(moment.source, 'a figure with no source on screen').toBeTruthy();
        // The source names who and when: a bare institution is not a source.
        expect(moment.source).toMatch(/\d{4}/);
      } else {
        // A source with nothing to source is noise, and hides that the moment
        // carries no figure at all.
        expect(moment.source).toBeUndefined();
      }
    },
  );

  it('states the ENAFIN figure with the verb the bulletin uses', () => {
    const fact = momentByOrder(1)!;
    expect(plain(fact.body)).toContain('42.3 %');
    expect(fact.source).toBe('INEGI · ENAFIN 2024');
    // "ha tenido financiamiento" is the bulletin's own text. The chart says
    // "solicitado", which is a different measure — having asked is not having
    // had.
    expect(fact.body).toContain('ha tenido financiamiento');
    expect(fact.body).not.toContain('solicitado');
    // And the measure is the majority owner or partner. "Empresas lideradas
    // por mujeres" is a looser claim than ENAFIN measured, so shortening the
    // sentence must never reach for it.
    expect(fact.body).toMatch(/due[ñn]a o socia mayoritaria/i);
    expect(fact.body).not.toMatch(/liderad/i);
    // The figure never wraps away from its unit.
    expect(fact.body).toContain('42.3 %');
  });

  it('publishes no figure this repository could not source', () => {
    const UNSOURCED = /(1 de cada 3|98 mil millones|US\$98|21\s?%|16\s?%|68\s?%|80\s?%|47\.4)/i;
    for (const moment of PROGRESS_MOMENTS) {
      const copy = [moment.eyebrow, moment.title, plain(moment.body)].join(' ');
      expect(copy, `${moment.order} states a figure with no primary source`).not.toMatch(UNSOURCED);
    }
  });
});

describe('the tone', () => {
  const PITY = /(desfavorecid|vulnerable|ayudamos a las mujeres|pobre|lamentablemente|desafortunad)/i;
  const JARGON = /(inclusión financiera|empoderamiento|ecosistema|sinergia|ESG|stakeholder)/i;
  // Nothing here may promise what no catalogue produced.
  const PROMISE = /(tasa|plazo|apruebad|te prestamos|crédito aprobado|meses sin intereses)/i;

  it.each(PROGRESS_MOMENTS.map((moment) => [moment.order, moment] as const))(
    'moment %i speaks to her as a business owner, not as a case',
    (_order, moment) => {
      const copy = [moment.eyebrow, moment.title, plain(moment.body)].join(' ');
      expect(copy).not.toMatch(PITY);
      expect(copy).not.toMatch(JARGON);
      expect(copy).not.toMatch(PROMISE);
    },
  );
});
