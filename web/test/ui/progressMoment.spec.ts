// progressMoment.spec.ts
// The popover's markup contract: the visual leads, it announces politely, it
// carries nothing interactive, and the checklist stays orientation rather
// than growing into a dashboard.

import { describe, expect, it } from 'vitest';
import {
  MAX_PENDING_SHOWN,
  renderProgressMoment,
  renderProgressMomentHost,
  type MomentChecklistItem,
} from '../../src/ui/progressMoment';
import { PROGRESS_MOMENTS, momentByOrder } from '../../src/content/waitingMoments';

const JOURNEY: readonly MomentChecklistItem[] = [
  { label: 'Quién eres', state: 'done' },
  { label: 'Tu respaldo', state: 'active' },
  { label: 'Qué compartiste', state: 'pending' },
  { label: 'Tu resultado', state: 'pending' },
];

describe('the popover announces without interrupting', () => {
  it.each(PROGRESS_MOMENTS.map((moment) => [moment.order, moment] as const))(
    'moment %i',
    (_order, moment) => {
      const html = renderProgressMoment(moment, JOURNEY);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      // Polite or nothing: this never cuts across what she is reading.
      expect(html).not.toContain('assertive');
    },
  );
});

describe('the popover takes no interaction at all', () => {
  it.each(PROGRESS_MOMENTS.map((moment) => [moment.order, moment] as const))(
    'moment %i offers nothing to tap',
    (_order, moment) => {
      const html = renderProgressMoment(moment, JOURNEY);
      expect(html).not.toMatch(/<(button|a|input|select|textarea)\b/);
      expect(html).not.toContain('tabindex');
      expect(html).not.toMatch(/cerrar|descartar|saber más|ver más/i);
    },
  );
});

describe('the visual leads', () => {
  it.each(PROGRESS_MOMENTS.map((moment) => [moment.order, moment] as const))(
    'moment %i opens with its icon, ahead of every word',
    (_order, moment) => {
      const html = renderProgressMoment(moment, JOURNEY);
      expect(html).toContain(`data-visual="${moment.visual}"`);
      expect(html.indexOf('moment-art')).toBeLessThan(html.indexOf('moment-eyebrow'));
    },
  );

  it('hides the icon from screen readers, because the title already says it', () => {
    const html = renderProgressMoment(momentByOrder(1)!, JOURNEY);
    expect(html).toMatch(/class="moment-art"[^>]*aria-hidden="true"/);
  });

  it('draws the icons in the product idiom: line, round caps, no fill', () => {
    for (const moment of PROGRESS_MOMENTS) {
      const html = renderProgressMoment(moment, JOURNEY);
      expect(html).toContain('stroke="currentColor"');
      expect(html).toContain('stroke-linecap="round"');
      expect(html).toContain('stroke-linejoin="round"');
      expect(html).toContain('fill="none"');
    }
  });
});

describe('the source appears only where a figure does', () => {
  it('carries the citation on the one moment that states a number', () => {
    expect(renderProgressMoment(momentByOrder(1)!, JOURNEY)).toContain('INEGI · ENAFIN 2024');
    for (const order of [2, 3, 4]) {
      expect(renderProgressMoment(momentByOrder(order)!, JOURNEY)).not.toContain('moment-source');
    }
  });
});

describe('the checklist orients rather than documents', () => {
  it('appears on the structural moment and nowhere else', () => {
    expect(renderProgressMoment(momentByOrder(3)!, JOURNEY)).toContain('moment-checklist');
    for (const order of [1, 2, 4]) {
      expect(renderProgressMoment(momentByOrder(order)!, JOURNEY)).not.toContain('moment-checklist');
    }
  });

  it('shows what is finished beside what is left, so it reads as progress', () => {
    const html = renderProgressMoment(momentByOrder(3)!, JOURNEY);
    expect(html).toContain("data-state=\"done\"");
    expect(html).toContain("data-state=\"pending\"");
    expect(html).toContain('Quién eres');
    expect(html).toContain('Tu resultado');
  });

  it('counts the overflow instead of listing it', () => {
    const long: readonly MomentChecklistItem[] = [
      { label: 'Uno', state: 'done' },
      { label: 'Dos', state: 'pending' },
      { label: 'Tres', state: 'pending' },
      { label: 'Cuatro', state: 'pending' },
      { label: 'Cinco', state: 'pending' },
    ];
    const html = renderProgressMoment(momentByOrder(3)!, long);
    expect([...html.matchAll(/data-state="pending"/g)]).toHaveLength(MAX_PENDING_SHOWN);
    expect(html).toContain('+ 2 elementos más');
    expect(html).not.toContain('Cuatro');
  });

  it('says "elemento" in the singular when only one is hidden', () => {
    const long: readonly MomentChecklistItem[] = [
      { label: 'Uno', state: 'pending' },
      { label: 'Dos', state: 'pending' },
      { label: 'Tres', state: 'pending' },
    ];
    expect(renderProgressMoment(momentByOrder(3)!, long)).toContain('+ 1 elemento más');
  });

  it('leaves the moment alone when the journey hands it nothing', () => {
    expect(renderProgressMoment(momentByOrder(3)!, [])).not.toContain('moment-checklist');
  });
});

describe('the host', () => {
  it('mounts empty, so nothing is on screen before a wait starts', () => {
    expect(renderProgressMomentHost()).toMatch(/<div class="progress-moment-host" id="[^"]+"><\/div>/);
  });
});
