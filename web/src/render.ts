// render.ts
// Pure HTML-string renderers, one per screen. Kept string-in/string-out (no
// DOM APIs) so layout and copy assertions can run under plain vitest.

import type { CompareContent } from './screens/compareContent';
import type { DemoScenario } from './domain/demoOutcome';
import { DEMO_SCENARIOS, DEMO_SCENARIO_LABELS } from './domain/demoOutcome';
import type { OffersContent } from './screens/offersContent';
import type { ProofScreenContent } from './screens/proofScreen';

const SYNTHETIC_BADGE = '<span class="badge-synthetic">SYNTHETIC</span>';

function scenarioOptions(selected: DemoScenario): string {
  return DEMO_SCENARIOS.map(
    (scenario) =>
      `<option value="${scenario}" ${scenario === selected ? 'selected' : ''}>${DEMO_SCENARIO_LABELS[scenario]}</option>`,
  ).join('');
}

export function renderProofScreen(
  content: ProofScreenContent,
  stepLabel: string,
  scenario: DemoScenario,
): string {
  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="intro">${content.intro}</p>
    <label class="demo-control">
      <span>Demo outcome (synthetic — for review only) ${SYNTHETIC_BADGE}</span>
      <select data-role="scenario-select">${scenarioOptions(scenario)}</select>
    </label>
    <div class="status-panel" data-phase="${content.ctaAction === 'start' && content.ctaDisabled ? 'generating' : ''}">
      <p class="status-heading">${content.statusHeading}</p>
      <p class="status-body">${content.statusBody}</p>
      ${content.synthetic ? `<p>${SYNTHETIC_BADGE}</p>` : ''}
    </div>
    <button class="btn" data-role="cta" ${content.ctaDisabled ? 'disabled' : ''}>${content.ctaLabel}</button>
  `;
}

export function renderCompareScreen(content: CompareContent, stepLabel: string): string {
  const rows = (items: CompareContent['leftRows']) =>
    items.map((row) => `<li><span class="compare-icon" aria-hidden="true">${row.icon}</span>${row.label}</li>`).join('');

  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <div class="compare-grid">
      <section class="compare-col compare-col--exposed">
        <h2>${content.leftTitle}</h2>
        <ul>${rows(content.leftRows)}</ul>
      </section>
      <section class="compare-col compare-col--sealed">
        <h2>${content.rightTitle}</h2>
        <ul>${rows(content.rightRows)}</ul>
      </section>
    </div>
    <button class="btn" data-role="cta">${content.ctaLabel}</button>
  `;
}

export function renderOffersScreen(content: OffersContent, stepLabel: string): string {
  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="tier-badge">${content.tierLabel} ${SYNTHETIC_BADGE}</p>
    <p class="disclaimer">${content.disclaimer}</p>
    <button class="btn" data-role="cta">${content.ctaLabel}</button>
  `;
}
