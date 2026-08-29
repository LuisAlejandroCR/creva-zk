// render.ts
// Pure HTML-string renderers, one per screen. Kept string-in/string-out (no
// DOM APIs) so layout and copy assertions can run under plain vitest. The
// data-role hooks are what waitView.ts patches in place while a proof runs.

import type { CompareContent } from './screens/compareContent';
import type { OffersContent } from './screens/offersContent';
import type { ProofScreenContent, TechDetail } from './screens/proofScreen';
import { OVERTIME_NOTE, WAIT_PROMISE, type WaitProgress } from './domain/waitStages';

const SYNTHETIC_BADGE = '<span class="badge-synthetic">Sintético</span>';

// Closed by default, always. The first read has to work without it; the
// second read is what opens it.
function renderTech(tech: TechDetail): string {
  return `
    <details class="tech">
      <summary class="tech-summary">${tech.summary}</summary>
      <div class="tech-body">${tech.body}</div>
    </details>
  `;
}

// The wait screen. Every stage is on screen from the first millisecond —
// done, running or still ahead — so the ~24s reads as a sequence she can
// follow rather than a spinner she has to trust.
function renderWait(wait: WaitProgress): string {
  const stages = wait.stages
    .map(
      (stage, index) => `
      <li class="wait-stage" data-stage-index="${index}" data-status="${stage.status}">
        <span class="wait-stage-mark" aria-hidden="true"></span>
        <span class="wait-stage-copy">
          <span class="wait-stage-label">${stage.label}</span>
          <span class="wait-stage-detail">${stage.detail}</span>
        </span>
      </li>`,
    )
    .join('');

  return `
    <section class="wait" data-role="wait" data-overtime="${wait.overtime}">
      <p class="wait-promise"><span class="wait-lock" aria-hidden="true">🔒</span>${WAIT_PROMISE}</p>
      <div class="wait-meter" role="progressbar" aria-label="Avance de la revisión" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${wait.percent}" data-role="wait-meter">
        <span class="wait-meter-fill" data-role="wait-meter-fill" style="width: ${wait.percent}%"></span>
      </div>
      <p class="wait-elapsed" data-role="wait-elapsed">${wait.elapsedLabel}</p>
      <ol class="wait-stages" aria-live="polite">${stages}</ol>
      <p class="wait-overtime" data-role="wait-overtime">${OVERTIME_NOTE}</p>
    </section>
  `;
}

export function renderProofScreen(content: ProofScreenContent, stepLabel: string): string {
  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="intro">${content.intro}</p>
    <div class="status-panel" data-phase="${content.phase}">
      <p class="status-heading">${content.statusHeading}</p>
      <p class="status-body">${content.statusBody}</p>
      ${content.wait ? renderWait(content.wait) : ''}
      ${content.synthetic ? `<p>${SYNTHETIC_BADGE}</p>` : ''}
    </div>
    <button class="btn-primary" data-role="cta" ${content.ctaDisabled ? 'disabled' : ''}>${content.ctaLabel}</button>
    ${renderTech(content.tech)}
  `;
}

export function renderCompareScreen(content: CompareContent, stepLabel: string): string {
  // Left: the item, legible, crossing over to the counterparty (an arrow per
  // row). Right: the same item struck through — nothing here crosses.
  const exposedRows = content.items
    .map(
      (item) =>
        `<li><span class="compare-icon" aria-hidden="true">${item.icon}</span>${item.label}<span class="compare-arrow" aria-hidden="true">→</span></li>`,
    )
    .join('');

  const sealedRows = content.items
    .map(
      (item) =>
        `<li class="compare-item--crossed"><span class="compare-icon" aria-hidden="true">${item.icon}</span>${item.label}</li>`,
    )
    .join('');

  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="intro">${content.intro}</p>
    <div class="compare-grid">
      <section class="compare-col compare-col--exposed">
        <h2>${content.leftTitle}</h2>
        <ul>${exposedRows}</ul>
        <p class="compare-counterparty"><span aria-hidden="true">${content.counterpartyIcon}</span>${content.counterpartyLabel}</p>
      </section>
      <section class="compare-col compare-col--sealed">
        <h2>${content.rightTitle}</h2>
        <ul>${sealedRows}</ul>
        <p class="compare-outcome-chip"><span aria-hidden="true">${content.outcomeChip.icon}</span>${content.outcomeChip.label}</p>
      </section>
    </div>
    <button class="btn-primary" data-role="cta">${content.ctaLabel}</button>
    ${renderTech(content.tech)}
  `;
}

export function renderOffersScreen(content: OffersContent, stepLabel: string): string {
  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="tier-badge">${content.tierLabel} <span class="badge-success">Comprobado</span> ${SYNTHETIC_BADGE}</p>
    <p class="intro">${content.summary}</p>
    <p class="disclaimer">${content.disclaimer}</p>
    <button class="btn-primary" data-role="cta">${content.ctaLabel}</button>
    ${renderTech(content.tech)}
  `;
}
