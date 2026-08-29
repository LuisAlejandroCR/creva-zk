// app.ts
// The journey's stateful glue: owns the current step and both proof states,
// wires the single CTA per screen, and re-renders on every state change.
// Every proof outcome comes from the seam in proofPort.ts — this file holds
// no outcomes of its own. The help centre renders over the same root, and
// the journey's state survives the visit.

import type { Tier } from './domain/tier';
import type { ProofState } from './domain/proofState';
import { STUB_LATENCY_MS, idleProof } from './domain/proofState';
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
import { buildStepProgress, type StepProgress } from './domain/journeyProgress';
import { applyWaitProgress, type WaitPatch } from './waitView';
import { parseHelpRoute } from './help/helpRoute';
import { renderHelpArticle, renderHelpCategory, renderHelpIndex } from './help/helpRender';

type Step = 'identity' | 'backing' | 'compare' | 'offers';

interface AppState {
  step: Step;
  identity: ProofState<boolean>;
  backing: ProofState<Tier>;
}

// Each step named after what it is about rather than after the mechanism
// behind it. The order here is the journey's order, and the step indicator
// on every screen is counted from it.
const STEP_NAMES: readonly (readonly [Step, string])[] = [
  ['identity', 'Quién eres'],
  ['backing', 'Tu respaldo'],
  ['compare', 'Qué compartiste'],
  ['offers', 'Tu resultado'],
];

function progressFor(step: Step): StepProgress {
  const index = STEP_NAMES.findIndex(([name]) => name === step);
  return buildStepProgress(index + 1, STEP_NAMES.length, STEP_NAMES[index]![1]);
}

// Fast enough that the ring advances continuously rather than in one-second
// jumps, and cheap because a tick only patches a few fields.
const TICK_MS = 200;

interface ScreenView {
  /** Identity of the rendered markup: same key means only the wait moved. */
  readonly key: string;
  readonly html: string;
  /** Present only while a proof runs: the fields to patch in place. */
  readonly waitPatch?: WaitPatch;
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
      html: renderProofScreen(content, progressFor('identity')),
      waitPatch: content.wait && { wait: content.wait, title: content.title, lede: content.lede },
    };
  }

  if (state.step === 'backing') {
    const content = buildBackingContent(state.backing, now);
    return {
      key: `backing:${content.phase}`,
      html: renderProofScreen(content, progressFor('backing')),
      waitPatch: content.wait && { wait: content.wait, title: content.title, lede: content.lede },
    };
  }

  if (state.step === 'compare') {
    return {
      key: 'compare',
      html: renderCompareScreen(buildCompareContent(), progressFor('compare')),
    };
  }

  // Only a ready backing proof carries a tier; anything else reaches the
  // offers screen with none.
  return {
    key: 'offers',
    html: renderOffersScreen(buildOffersContent(state.backing.value ?? 'none'), progressFor('offers')),
  };
}

// Rendering the help centre over the journey's own root, rather than in a
// second mount, is what keeps a proof running while she reads: the state and
// the ticker are untouched, only the markup is swapped.
function renderHelpRoute(root: HTMLElement, hash: string): boolean {
  const route = parseHelpRoute(hash);
  if (route.kind === 'journey') return false;

  root.innerHTML =
    route.kind === 'index'
      ? renderHelpIndex()
      : route.kind === 'category'
        ? renderHelpCategory(route.category)
        : renderHelpArticle(route.category, route.article);
  return true;
}

export function mountApp(root: HTMLElement): void {
  let state = initialState();
  // Bumped on every start, so a proof left running by "start over" cannot
  // land on the screen after the journey moved on.
  let generation = 0;
  let tickHandle: ReturnType<typeof setInterval> | undefined;
  let renderedKey: string | undefined;
  // While she is in the help centre the journey keeps its state and its
  // ticker, and simply stops drawing. A proof started before she left is
  // still running when she comes back.
  let showingHelp = false;

  function stopTicking(): void {
    if (tickHandle !== undefined) clearInterval(tickHandle);
    tickHandle = undefined;
  }

  function render(): void {
    if (showingHelp) return;
    const view = buildView(state, Date.now());

    // Same screen, still waiting: patch the few fields that moved so the CSS
    // transitions on the ring and the step marks are never interrupted.
    if (view.key === renderedKey && view.waitPatch) {
      applyWaitProgress(root, view.waitPatch);
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

  function route(): void {
    const wasShowingHelp = showingHelp;
    showingHelp = renderHelpRoute(root, window.location.hash);
    if (showingHelp) return;

    // Coming back from help: the markup is gone, so force a full redraw
    // rather than trusting the key from before she left.
    if (wasShowingHelp) renderedKey = undefined;
    render();
  }

  window.addEventListener('hashchange', route);
  route();
}
