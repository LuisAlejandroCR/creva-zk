// render.ts
// Pure HTML-string renderers, one per screen. Kept string-in/string-out (no
// DOM APIs) so layout and copy assertions can run under plain vitest. The
// data-role hooks are what waitView.ts patches in place while a proof runs.
// Explanations are not rendered here: every screen carries a ? instead.

import type { CompareContent } from './screens/compareContent';
import type { OffersContent } from './screens/offersContent';
import type { ProofScreenContent } from './screens/proofScreen';
import type { StepProgress } from './domain/journeyProgress';
import {
  OVERTIME_NOTE,
  WAIT_PROMISE,
  type CurrentWaitStage,
  type WaitProgress,
} from './domain/waitStages';
import { renderHelpLink } from './help/helpRender';

const SYNTHETIC_BADGE = '<span class="badge-synthetic">Sintético</span>';

// Where she is, and what is behind and ahead of her. The second line is the
// one a four-step form usually leaves her to count for herself.
function renderProgress(progress: StepProgress): string {
  return `
    <div class="progress-block" role="group" aria-label="Avance de tu solicitud">
      <p class="progress">${progress.label}</p>
      <p class="progress-tally">${progress.tally}</p>
    </div>
  `;
}

// One step, the one happening now. A list of four read as a to-do list she
// still had to get through; a single line reads as work being done. The
// meter and the seconds carry the sense of progress the list used to.
export function renderWaitStage(stage: CurrentWaitStage): string {
  return `<div class="wait-stage" data-role="wait-stage" data-stage-index="${stage.index}" data-status="${stage.status}">
        <span class="wait-stage-mark" aria-hidden="true"></span>
        <span class="wait-stage-copy">
          <span class="wait-stage-label">${stage.label}</span>
          <span class="wait-stage-detail">${stage.detail}</span>
        </span>
      </div>`;
}

function renderWait(wait: WaitProgress): string {
  return `
    <section class="wait" data-role="wait" data-overtime="${wait.overtime}">
      <p class="wait-promise"><span class="wait-lock" aria-hidden="true">🔒</span>${WAIT_PROMISE}</p>
      <div class="wait-meter" role="progressbar" aria-label="Avance de la revisión" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${wait.percent}" data-role="wait-meter">
        <span class="wait-meter-fill" data-role="wait-meter-fill" style="width: ${wait.percent}%"></span>
      </div>
      <p class="wait-elapsed" data-role="wait-elapsed">${wait.elapsedLabel}</p>
      <div class="wait-stage-slot" data-role="wait-stage-slot" aria-live="polite">${renderWaitStage(wait.current)}</div>
      <p class="wait-overtime" data-role="wait-overtime">${OVERTIME_NOTE}</p>
    </section>
  `;
}

export function renderProofScreen(content: ProofScreenContent, progress: StepProgress): string {
  return `
    ${renderProgress(progress)}
    <h1>${content.h1}</h1>
    <p class="intro">${content.intro}</p>
    <div class="status-panel" data-phase="${content.phase}">
      <p class="status-heading">${content.statusHeading}</p>
      <p class="status-body">${content.statusBody}</p>
      ${content.wait ? renderWait(content.wait) : ''}
      ${content.synthetic ? `<p>${SYNTHETIC_BADGE}</p>` : ''}
    </div>
    <button class="btn-primary" data-role="cta" ${content.ctaDisabled ? 'disabled' : ''}>${content.ctaLabel}</button>
    ${renderHelpLink(content.help)}
  `;
}

export function renderCompareScreen(content: CompareContent, progress: StepProgress): string {
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
    ${renderProgress(progress)}
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
    ${renderHelpLink(content.help)}
  `;
}

export function renderOffersScreen(content: OffersContent, progress: StepProgress): string {
  return `
    ${renderProgress(progress)}
    <h1>${content.h1}</h1>
    <section class="tier-reveal">
      <p class="tier-milestone">${content.milestone}</p>
      <p class="tier-badge">${content.tierLabel} <span class="badge-success">Comprobado</span> ${SYNTHETIC_BADGE}</p>
    </section>
    <p class="intro">${content.summary}</p>
    <p class="disclaimer">${content.disclaimer}</p>
    <button class="btn-primary" data-role="cta">${content.ctaLabel}</button>
    ${renderHelpLink(content.help)}
  `;
}
