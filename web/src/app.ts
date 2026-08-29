// app.ts
// The journey's stateful glue: owns the current step and both proof states,
// wires the single CTA per screen, and re-renders on every state change.
// Every proof outcome comes from the seam in proofPort.ts — this file holds
// no outcomes of its own.

import type { Tier } from './domain/tier';
import type { ProofState } from './domain/proofState';
import { STUB_LATENCY_MS, idleProof } from './domain/proofState';
import type { WaitProgress } from './domain/waitStages';
import {
  SYNTHETIC_ISSUER_KEY,
  SYNTHETIC_REQUESTED_LIMIT,
  SYNTHETIC_TAX_ID_HASH,
  backingHolds,
  identityHolds,
} from './domain/demoInputs';
import { activePortSource, selectBackingPort, selectIdentityPort } from './proofPort';
import { runProof } from './proofRun';
import { buildIdentityContent } from './screens/identityContent';
import { buildBackingContent } from './screens/backingContent';
import { buildCompareContent } from './screens/compareContent';
import { buildOffersContent } from './screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from './render';
import { applyWaitProgress } from './waitView';

type Step = 'identity' | 'backing' | 'compare' | 'offers';

interface AppState {
  step: Step;
  identity: ProofState<boolean>;
  backing: ProofState<Tier>;
}

// Where she is, named after what the step is about rather than after the
// mechanism behind it.
const STEP_LABELS: Readonly<Record<Step, string>> = {
  identity: 'Paso 1 de 4 · Quién eres',
  backing: 'Paso 2 de 4 · Tu respaldo',
  compare: 'Paso 3 de 4 · Qué compartiste',
  offers: 'Paso 4 de 4 · Tu resultado',
};

// Fast enough that the meter moves continuously rather than in one-second
// jumps, and cheap because a tick only patches a few fields.
const TICK_MS = 200;

interface ScreenView {
  /** Identity of the rendered markup: same key means only the wait moved. */
  readonly key: string;
  readonly html: string;
  readonly wait?: WaitProgress;
}

function initialState(): AppState {
  return {
    step: 'identity',
    identity: idleProof<boolean>(),
    backing: idleProof<Tier>(),
  };
}

// Only the stub is held: it answers instantly, and without this the wait
// screen would never be seen. A real or bridged proof takes the time it
// takes.
function stubHold(): number {
  return activePortSource() === 'stub' ? STUB_LATENCY_MS : 0;
}

function buildView(state: AppState, now: number): ScreenView {
  if (state.step === 'identity') {
    const content = buildIdentityContent(state.identity, now);
    return {
      key: `identity:${content.phase}`,
      html: renderProofScreen(content, STEP_LABELS.identity),
      wait: content.wait,
    };
  }

  if (state.step === 'backing') {
    const content = buildBackingContent(state.backing, now);
    return {
      key: `backing:${content.phase}`,
      html: renderProofScreen(content, STEP_LABELS.backing),
      wait: content.wait,
    };
  }

  if (state.step === 'compare') {
    return {
      key: 'compare',
      html: renderCompareScreen(buildCompareContent(), STEP_LABELS.compare),
    };
  }

  // Only a ready backing proof carries a tier; anything else reaches the
  // offers screen with none.
  return {
    key: 'offers',
    html: renderOffersScreen(buildOffersContent(state.backing.value ?? 'none'), STEP_LABELS.offers),
  };
}

export function mountApp(root: HTMLElement): void {
  let state = initialState();
  // Bumped on every start, so a proof left running by "start over" cannot
  // land on the screen after the journey moved on.
  let generation = 0;
  let tickHandle: ReturnType<typeof setInterval> | undefined;
  let renderedKey: string | undefined;

  function stopTicking(): void {
    if (tickHandle !== undefined) clearInterval(tickHandle);
    tickHandle = undefined;
  }

  function render(): void {
    const view = buildView(state, Date.now());

    // Same screen, still waiting: patch the few fields that moved so the CSS
    // transitions on the meter and the stage marks are never interrupted.
    if (view.key === renderedKey && view.wait) {
      applyWaitProgress(root, view.wait);
      return;
    }

    renderedKey = view.key;
    root.innerHTML = view.html;
    attachHandlers();
  }

  function startProof(kind: 'identity' | 'backing'): void {
    generation += 1;
    const runGeneration = generation;
    stopTicking();

    // The wait screen is the only thing that changes while the call is in
    // flight, so the ticker exists purely to keep its sequence honest.
    tickHandle = setInterval(() => {
      if (runGeneration === generation) render();
    }, TICK_MS);

    const emit = (next: ProofState<boolean> | ProofState<Tier>): void => {
      if (runGeneration !== generation) return;
      state =
        kind === 'identity'
          ? { ...state, identity: next as ProofState<boolean> }
          : { ...state, backing: next as ProofState<Tier> };
      if (next.phase !== 'generating') stopTicking();
      render();
    };

    const run =
      kind === 'identity'
        ? runProof<boolean>({
            call: () =>
              selectIdentityPort().checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH),
            holds: identityHolds,
            emit,
            minimumMs: stubHold(),
          })
        : runProof<Tier>({
            call: () => selectBackingPort().checkBacking(SYNTHETIC_REQUESTED_LIMIT),
            holds: backingHolds,
            emit,
            minimumMs: stubHold(),
          });

    // runProof never rejects; this only keeps the floating promise explicit.
    void run.finally(() => {
      if (runGeneration === generation) stopTicking();
    });
  }

  function attachHandlers(): void {
    const cta = root.querySelector<HTMLButtonElement>('[data-role="cta"]');

    cta?.addEventListener('click', () => {
      if (state.step === 'identity') {
        // Degraded offers retry, never a way past an unanswered check.
        if (state.identity.phase === 'ready') {
          state = { ...state, step: 'backing' };
          render();
        } else if (state.identity.phase !== 'generating') {
          startProof('identity');
        }
        return;
      }

      if (state.step === 'backing') {
        if (state.backing.phase === 'ready') {
          state = { ...state, step: 'compare' };
          render();
        } else if (state.backing.phase !== 'generating') {
          startProof('backing');
        }
        return;
      }

      if (state.step === 'compare') {
        state = { ...state, step: 'offers' };
        render();
        return;
      }

      // offers: start over
      generation += 1;
      stopTicking();
      state = initialState();
      render();
    });
  }

  render();
}
