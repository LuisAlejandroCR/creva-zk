// app.ts
// The journey's stateful glue: owns the current step and both proof states,
// wires the single CTA per screen, and re-renders on every state change.
// Every proof outcome comes from src/domain's stub — never a network call.

import type { Tier } from './domain/tier';
import type { DemoScenario } from './domain/demoOutcome';
import { backingOutcomeFor, identityOutcomeFor } from './domain/demoOutcome';
import type { ProofState } from './domain/proofState';
import { GENERATING_DURATION_MS, idleProof, settleDegraded, settleFailed, settleReady, startGenerating } from './domain/proofState';
import { buildIdentityContent } from './screens/identityContent';
import { buildBackingContent } from './screens/backingContent';
import { buildCompareContent } from './screens/compareContent';
import { buildOffersContent } from './screens/offersContent';
import { renderCompareScreen, renderOffersScreen, renderProofScreen } from './render';

type Step = 'identity' | 'backing' | 'compare' | 'offers';

interface AppState {
  step: Step;
  identityScenario: DemoScenario;
  backingScenario: DemoScenario;
  identity: ProofState<boolean>;
  backing: ProofState<Tier>;
}

const STEP_LABELS: Readonly<Record<Step, string>> = {
  identity: 'Paso 1 de 4 — Identidad',
  backing: 'Paso 2 de 4 — Respaldo',
  compare: 'Paso 3 de 4 — Comparación',
  offers: 'Paso 4 de 4 — Ofertas',
};

function initialState(): AppState {
  return {
    step: 'identity',
    identityScenario: 'ready',
    backingScenario: 'ready',
    identity: idleProof<boolean>(),
    backing: idleProof<Tier>(),
  };
}

export function mountApp(root: HTMLElement): void {
  let state = initialState();
  let tickHandle: ReturnType<typeof setInterval> | undefined;
  let settleHandle: ReturnType<typeof setTimeout> | undefined;

  function clearTimers(): void {
    if (tickHandle !== undefined) clearInterval(tickHandle);
    if (settleHandle !== undefined) clearTimeout(settleHandle);
    tickHandle = undefined;
    settleHandle = undefined;
  }

  function render(): void {
    if (state.step === 'identity') {
      const content = buildIdentityContent(state.identity, Date.now());
      root.innerHTML = renderProofScreen(content, STEP_LABELS.identity, state.identityScenario);
    } else if (state.step === 'backing') {
      const content = buildBackingContent(state.backing, Date.now());
      root.innerHTML = renderProofScreen(content, STEP_LABELS.backing, state.backingScenario);
    } else if (state.step === 'compare') {
      root.innerHTML = renderCompareScreen(buildCompareContent(), STEP_LABELS.compare);
    } else {
      const tier = state.backing.value ?? 'none';
      root.innerHTML = renderOffersScreen(buildOffersContent(tier), STEP_LABELS.offers);
    }
    attachHandlers();
  }

  function startProof(kind: 'identity' | 'backing'): void {
    clearTimers();
    const startedAt = Date.now();
    if (kind === 'identity') {
      state = { ...state, identity: startGenerating(startedAt) };
    } else {
      state = { ...state, backing: startGenerating(startedAt) };
    }
    render();

    tickHandle = setInterval(render, 1000);
    settleHandle = setTimeout(() => {
      clearTimers();
      if (kind === 'identity') {
        const scenario = state.identityScenario;
        const verified = identityOutcomeFor(scenario);
        state = {
          ...state,
          identity: scenario === 'failed' ? settleFailed<boolean>() : scenario === 'degraded' ? settleDegraded(verified) : settleReady(verified),
        };
      } else {
        const scenario = state.backingScenario;
        const tier = backingOutcomeFor(scenario);
        state = {
          ...state,
          backing: scenario === 'failed' ? settleFailed<Tier>() : scenario === 'degraded' ? settleDegraded(tier) : settleReady(tier),
        };
      }
      render();
    }, GENERATING_DURATION_MS);
  }

  function attachHandlers(): void {
    const scenarioSelect = root.querySelector<HTMLSelectElement>('[data-role="scenario-select"]');
    const cta = root.querySelector<HTMLButtonElement>('[data-role="cta"]');

    scenarioSelect?.addEventListener('change', () => {
      const value = scenarioSelect.value as DemoScenario;
      if (state.step === 'identity') state = { ...state, identityScenario: value };
      else if (state.step === 'backing') state = { ...state, backingScenario: value };
    });

    cta?.addEventListener('click', () => {
      if (state.step === 'identity') {
        if (state.identity.phase === 'idle' || state.identity.phase === 'failed') {
          startProof('identity');
        } else if (state.identity.phase === 'ready' || state.identity.phase === 'degraded') {
          state = { ...state, step: 'backing' };
          render();
        }
        return;
      }

      if (state.step === 'backing') {
        if (state.backing.phase === 'idle' || state.backing.phase === 'failed') {
          startProof('backing');
        } else if (state.backing.phase === 'ready' || state.backing.phase === 'degraded') {
          state = { ...state, step: 'compare' };
          render();
        }
        return;
      }

      if (state.step === 'compare') {
        state = { ...state, step: 'offers' };
        render();
        return;
      }

      // offers: start over
      clearTimers();
      state = initialState();
      render();
    });
  }

  render();
}
