// financialFacts.spec.ts
// The rules the progress moments obey to ship: one figure in the whole
// journey, that figure names its source, the titles stay short enough to be
// a popover, and no moment promises an offer the product cannot make.

import { describe, expect, it } from 'vitest';
import {
  PROGRESS_MOMENTS,
  momentForStep,
  type ProgressMoment,
} from '../../src/content/financialFacts';

// A figure is a number the copy states. There is no separate stat field any
// more — the popover is one sentence — so the sentence is what is scanned.
const FIGURE = /\d+(?:[.,]\d+)?\s?%/;
const hasFigure = (moment: ProgressMoment): boolean => FIGURE.test(moment.body);

describe('the moments are well formed', () => {
  it('gives every step of the journey exactly one moment, in order', () => {
    expect(PROGRESS_MOMENTS.map((moment) => moment.step)).toEqual([1, 2, 3, 4]);
    for (const step of [1, 2, 3, 4]) expect(momentForStep(step)).toBeDefined();
    expect(momentForStep(5)).toBeUndefined();
  });

  it('keeps every title to two to four words', () => {
    for (const moment of PROGRESS_MOMENTS) {
      const words = moment.title.trim().split(/\s+/).length;
      expect(words, `${moment.step}: "${moment.title}" is ${words} words`).toBeGreaterThanOrEqual(2);
      expect(words, `${moment.step}: "${moment.title}" is ${words} words`).toBeLessThanOrEqual(4);
    }
  });

  it('keeps every body to one sentence short enough for a popover', () => {
    for (const moment of PROGRESS_MOMENTS) {
      // The terminator has to be followed by a space or the end of the
      // string, so the decimal point in "47.4%" is not counted as a sentence.
      const sentences = [...moment.body.matchAll(/[.!?](\s|$)/g)].length;
      expect(sentences, `${moment.step} body has ${sentences} sentences`).toBeLessThanOrEqual(2);
      expect(moment.body.length, `${moment.step} body too long`).toBeLessThanOrEqual(120);
      expect(moment.eyebrow === undefined || moment.eyebrow.length <= 18).toBe(true);
    }
  });

  it('uses the four variants and no others', () => {
    expect(new Set(PROGRESS_MOMENTS.map((moment) => moment.variant))).toEqual(
      new Set(['financialFact', 'encouragement', 'milestone', 'finalCelebration']),
    );
  });
});

// The verifier the loop names: one figure per journey.
describe('the cadence', () => {
  it('states exactly one figure across the whole onboarding', () => {
    const withFigures = PROGRESS_MOMENTS.filter(hasFigure);
    expect(
      withFigures.length,
      `steps ${withFigures.map((m) => m.step).join(', ')} state a figure`,
    ).toBe(1);
  });

  it('puts that figure on step 1 and never two in a row', () => {
    expect(hasFigure(momentForStep(1)!)).toBe(true);
    for (let i = 1; i < PROGRESS_MOMENTS.length; i += 1) {
      expect(hasFigure(PROGRESS_MOMENTS[i - 1]!) && hasFigure(PROGRESS_MOMENTS[i]!)).toBe(false);
    }
  });

  it('reads figure, encouragement, structural point, celebration', () => {
    expect(PROGRESS_MOMENTS.map((moment) => moment.variant)).toEqual([
      'financialFact',
      'encouragement',
      'milestone',
      'finalCelebration',
    ]);
  });

  it('ends on a celebration rather than on a statistic', () => {
    const last = PROGRESS_MOMENTS.at(-1)!;
    expect(last.variant).toBe('finalCelebration');
    expect(hasFigure(last)).toBe(false);
  });

  it('leaves the structural moment without a figure, because it needs none', () => {
    const structural = momentForStep(3)!;
    expect(hasFigure(structural)).toBe(false);
    expect(structural.source).toBeUndefined();
    expect(structural.body.toLowerCase()).toContain('creva empieza por hacerlo claro');
  });
});

describe('every figure names its source', () => {
  it.each(PROGRESS_MOMENTS.map((moment) => [moment.step, moment] as const))(
    'step %i',
    (_step, moment) => {
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
    const fact = momentForStep(1)!;
    expect(fact.body).toContain('42.3%');
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
  });

  it('publishes no figure this repository could not source', () => {
    // Every unsourced claim from the original brief. None may appear.
    const UNSOURCED = /(1 de cada 3|98 mil millones|US\$98|21\s?%|16\s?%|68\s?%|80\s?%)/i;
    for (const moment of PROGRESS_MOMENTS) {
      const copy = [moment.eyebrow ?? '', moment.title, moment.body].join(' ');
      expect(copy, `${moment.step} states a figure with no primary source`).not.toMatch(UNSOURCED);
    }
  });
});

describe('the tone the brief asked for', () => {
  const PITY = /(desfavorecid|vulnerable|ayudamos a las mujeres|pobre|lamentablemente|desafortunad)/i;
  const JARGON = /(inclusión financiera|empoderamiento|ecosistema|sinergia|ESG|stakeholder)/i;
  // Nothing here may promise what no catalogue produced.
  const PROMISE = /(tasa|plazo|apruebad|te prestamos|crédito aprobado|meses sin intereses)/i;

  it.each(PROGRESS_MOMENTS.map((moment) => [moment.step, moment] as const))(
    'step %i speaks to her as a business owner, not as a case',
    (_step, moment) => {
      const copy = [moment.eyebrow ?? '', moment.title, moment.body].join(' ');
      expect(copy).not.toMatch(PITY);
      expect(copy).not.toMatch(JARGON);
      expect(copy).not.toMatch(PROMISE);
    },
  );
});
