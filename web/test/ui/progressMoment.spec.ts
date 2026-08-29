// progressMoment.spec.ts
// The popover's markup contract: it announces politely, it carries nothing
// interactive, and its glyph is never the only thing saying what it means.

import { describe, expect, it } from 'vitest';
import { renderProgressMoment, renderProgressMomentHost } from '../../src/ui/progressMoment';
import { PROGRESS_MOMENTS, momentForStep } from '../../src/content/financialFacts';

const everyMoment = PROGRESS_MOMENTS.map((moment) => [moment.step, moment] as const);

describe('renderProgressMoment', () => {
  it.each(everyMoment)('step %i announces once, politely', (_step, moment) => {
    const html = renderProgressMoment(moment);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    // assertive would cut her off mid-sentence for something she can ignore.
    expect(html).not.toContain('assertive');
  });

  it.each(everyMoment)('step %i holds nothing she could or would have to touch', (_step, moment) => {
    const html = renderProgressMoment(moment);
    // No close button, no link, no focusable anything: the moment takes no
    // interaction, and nothing she needs in order to continue is inside it.
    expect(html).not.toMatch(/<(button|a|input|select|textarea)\b/i);
    expect(html).not.toContain('tabindex');
    expect(html).not.toMatch(/cerrar|descartar|saber más/i);
  });

  it.each(everyMoment)('step %i never lets the glyph carry the meaning alone', (_step, moment) => {
    const html = renderProgressMoment(moment);
    // The glyph is hidden from the accessibility tree precisely because the
    // words beside it already say it.
    expect(html).toMatch(/class="moment-mark" aria-hidden="true"/);
    expect(html).toContain(moment.title);
  });

  it('renders the source only where the copy states a figure', () => {
    expect(renderProgressMoment(momentForStep(1)!)).toContain('INEGI · ENAFIN 2024');
    for (const step of [2, 3, 4]) {
      expect(renderProgressMoment(momentForStep(step)!)).not.toContain('moment-source');
    }
  });

  it('mounts one host for the whole flow', () => {
    const host = renderProgressMomentHost();
    expect(host).toContain('id="progress-moment-host"');
    // Empty on mount: a popover only exists once a step has been completed.
    expect(host).toMatch(/<div[^>]*><\/div>/);
  });
});
