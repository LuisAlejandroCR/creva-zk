// momentView.spec.ts
// The scheduling contract, which is the whole point of the rework: a moment
// is armed by processing and dropped by the answer. It never delays the
// journey, never replays, and never fires because something was tapped.
//
// The project has no jsdom, so the host is a stand-in carrying only the few
// members momentView touches. The logic under test is timing, not layout.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMomentScheduler } from '../src/momentView';
import { MOMENT_CUES } from '../src/content/waitingMoments';

interface FakePopover {
  dataset: Record<string, string>;
  remove(): void;
}

function fakeHost(options: { strip?: boolean } = {}): {
  host: HTMLElement;
  shown(): string;
  leaving(): boolean;
} {
  let html = '';
  let popover: FakePopover | undefined;
  // The strip the popover hangs from. Absent on the help centre, which is the
  // one screen of the flow that does not render one.
  const topbar = options.strip === false
    ? null
    : { getBoundingClientRect: () => ({ bottom: 56, left: 0, width: 390 }) };

  const host = {
    style: {} as CSSStyleDeclaration,
    ownerDocument: { querySelector: () => topbar },
    get innerHTML(): string {
      return html;
    },
    set innerHTML(next: string) {
      html = next;
      popover = next.includes('data-role="progress-moment"')
        ? {
            dataset: {},
            remove: (): void => {
              html = '';
              popover = undefined;
            },
          }
        : undefined;
    },
    querySelector: (): FakePopover | null => popover ?? null,
  } as unknown as HTMLElement;

  return {
    host,
    shown: () => html,
    leaving: () => popover?.dataset.leaving === 'true',
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a moment lives inside the wait it belongs to', () => {
  it('shows nothing until processing has actually begun', () => {
    const { host, shown } = fakeHost();
    createMomentScheduler(host);
    vi.advanceTimersByTime(30_000);
    expect(shown()).toBe('');
  });

  it('brings the first moment out while the identity proof is still running', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    expect(shown()).toBe('');

    vi.advanceTimersByTime(1_400);
    expect(shown()).toContain('El acceso todavía importa');
  });

  it('brings out the second moment later in the same wait', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(12_000);
    expect(shown()).toContain('Ya estás más cerca');
  });

  it('takes the moment away on its own, with nothing tapped', () => {
    const { host, leaving } = fakeHost();
    const scheduler = createMomentScheduler(host, { visibleMs: 3_000 });

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    expect(leaving()).toBe(false);

    vi.advanceTimersByTime(3_000);
    expect(leaving()).toBe(true);
  });
});

describe('the wait owns the moment, never the other way round', () => {
  it('drops a cue that the answer beat, rather than showing it late', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    // The proof came back in two seconds. The 12s moment has run out of wait
    // to live in, and the journey is not held open so it can be seen.
    vi.advanceTimersByTime(2_000);
    scheduler.endWait('identity', 'ready');
    vi.advanceTimersByTime(60_000);

    expect(shown()).not.toContain('Ya estás más cerca');
  });

  it('clears whatever is on screen the instant processing ends', () => {
    const { host, leaving } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_500);
    scheduler.endWait('identity', 'ready');

    expect(leaving()).toBe(true);
  });
});

describe('the closing moment', () => {
  it('arrives with the answer, and only when there is one', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('backing');
    vi.advanceTimersByTime(1_400);
    expect(shown()).toContain('Solo falta un poco');

    scheduler.endWait('backing', 'ready');
    // Not on top of the answer: it waits for the tier to land first.
    expect(shown()).not.toContain('Lo conseguimos');
    vi.advanceTimersByTime(700);
    expect(shown()).toContain('Lo conseguimos');
  });

  it('stays away when nobody could answer', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('backing');
    vi.advanceTimersByTime(1_400);
    scheduler.endWait('backing', 'unanswered');
    vi.advanceTimersByTime(10_000);

    expect(shown()).not.toContain('Lo conseguimos');
  });

  it('never closes a wait that has no closing cue', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    scheduler.endWait('identity', 'ready');
    vi.advanceTimersByTime(1_000);

    // Everything the identity wait had to say, it said while it was waiting.
    expect(MOMENT_CUES.filter((cue) => cue.wait === 'identity' && cue.phase === 'settled')).toHaveLength(0);
    expect(shown()).toBe('');
  });
});

describe('a moment is seen once', () => {
  it('does not replay when the same wait is entered again', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    scheduler.endWait('identity', 'unanswered');
    vi.advanceTimersByTime(5_000);

    // Retrying after a degraded answer must not tell her the same thing twice.
    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    expect(shown()).toBe('');
  });

  it('starts the arc over when she starts the journey over', () => {
    const { host, shown } = fakeHost();
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    scheduler.reset();
    expect(shown()).toBe('');

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    expect(shown()).toContain('El acceso todavía importa');
  });
});

describe('there is no popover without a strip to hang it from', () => {
  it('drops the moment rather than landing it over the help centre', () => {
    const { host, shown } = fakeHost({ strip: false });
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(1_400);
    expect(shown()).toBe('');
  });

  it('does not hold it back to appear once she is somewhere else', () => {
    const { host, shown } = fakeHost({ strip: false });
    const scheduler = createMomentScheduler(host);

    scheduler.startWait('identity');
    vi.advanceTimersByTime(30_000);
    expect(shown()).toBe('');
  });
});

describe('the journey state reaches the checklist', () => {
  it('reads it at show time, so it is never a snapshot from before the wait', () => {
    const { host, shown } = fakeHost();
    let step = 'identity';
    const scheduler = createMomentScheduler(host, {
      checklist: () => [
        { label: 'Quién eres', state: step === 'identity' ? 'active' : 'done' },
        { label: 'Tu respaldo', state: step === 'identity' ? 'pending' : 'active' },
      ],
    });

    step = 'backing';
    scheduler.startWait('backing');
    vi.advanceTimersByTime(1_400);

    expect(shown()).toContain('Tu respaldo');
    expect(shown()).toMatch(/data-state="done"[\s\S]*Quién eres/);
  });
});
