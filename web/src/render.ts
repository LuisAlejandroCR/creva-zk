// render.ts
// Pure HTML-string renderers, one per screen. Kept string-in/string-out (no
// DOM APIs) so layout and copy assertions can run under plain vitest.

import type { CompareContent } from './screens/compareContent';
import type { OffersContent } from './screens/offersContent';
import type { ProofScreenContent } from './screens/proofScreen';

const SYNTHETIC_BADGE = '<span class="badge-synthetic">Sintético</span>';

export function renderProofScreen(content: ProofScreenContent, stepLabel: string): string {
  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="intro">${content.intro}</p>
    <div class="status-panel" data-phase="${content.phase}">
      <p class="status-heading">${content.statusHeading}</p>
      <p class="status-body">${content.statusBody}</p>
      ${content.synthetic ? `<p>${SYNTHETIC_BADGE}</p>` : ''}
    </div>
    <button class="btn-primary" data-role="cta" ${content.ctaDisabled ? 'disabled' : ''}>${content.ctaLabel}</button>
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
  `;
}

export function renderOffersScreen(content: OffersContent, stepLabel: string): string {
  return `
    <p class="progress">${stepLabel}</p>
    <h1>${content.h1}</h1>
    <p class="tier-badge">${content.tierLabel} <span class="badge-success">Nivel comprobado</span> ${SYNTHETIC_BADGE}</p>
    <p class="disclaimer">${content.disclaimer}</p>
    <button class="btn-primary" data-role="cta">${content.ctaLabel}</button>
  `;
}
