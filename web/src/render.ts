// render.ts
// Pure HTML-string renderers, one per screen. Kept string-in/string-out (no
// DOM APIs) so layout and copy assertions can run under plain vitest.
//
// Nothing here writes markup of its own: every screen is assembled out of
// the components in src/ui, and what differs between two steps is which
// blocks the archetype asks for and in what order. The data-role hooks are
// what waitView.ts patches in place while a proof runs. Explanations are not
// rendered here: every screen carries a ? instead.

import type { CompareContent } from './screens/compareContent';
import type { OffersContent } from './screens/offersContent';
import type { ProofScreenContent } from './screens/proofScreen';
import type { StepProgress } from './domain/journeyProgress';
import {
  MARK_CONFIRM,
  MARK_INTRO,
  MARK_RECOVER,
  renderHelpWhy,
  renderOnboardingShell,
  renderPrimaryAction,
  renderScreenHeader,
  renderSecurityNotice,
  renderStatusState,
  renderVerificationState,
} from './ui';

const SYNTHETIC_BADGE = '<span class="badge-synthetic">Sintético</span>';

// One mark per archetype, on the headline's own line. The shield carries
// both the invitation and the work: it is the same promise before and during,
// and changing the glyph mid-flight would suggest something else had.
const ARCHETYPE_MARK: Readonly<Record<string, string | undefined>> = {
  intro: MARK_INTRO,
  verifying: MARK_INTRO,
  confirm: MARK_CONFIRM,
  recover: MARK_RECOVER,
};

export function renderProofScreen(content: ProofScreenContent, progress: StepProgress): string {
  return renderOnboardingShell({
    archetype: content.archetype,
    phase: content.phase,
    step: progress,
    help: content.help,
    blocks: [
      renderScreenHeader({
        title: content.title,
        lede: content.lede,
        mark: ARCHETYPE_MARK[content.archetype],
      }),
      content.wait ? renderVerificationState(content.wait) : undefined,
      content.body === undefined || content.tone === undefined
        ? undefined
        : renderStatusState({
            tone: content.tone,
            body: content.body,
            badge: content.synthetic ? SYNTHETIC_BADGE : undefined,
          }),
      content.ctaLabel === undefined
        ? undefined
        : renderPrimaryAction({ label: content.ctaLabel, disabled: content.ctaDisabled }),
      content.askWhy ? renderHelpWhy(content.help) : undefined,
      content.security ? renderSecurityNotice(content.security) : undefined,
    ],
  });
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

  return renderOnboardingShell({
    archetype: 'compare',
    step: progress,
    help: content.help,
    blocks: [
      renderScreenHeader({ title: content.h1, lede: content.intro }),
      `
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
      </div>`,
      renderPrimaryAction({ label: content.ctaLabel }),
    ],
  });
}

export function renderOffersScreen(content: OffersContent, progress: StepProgress): string {
  return renderOnboardingShell({
    archetype: 'celebrate',
    step: progress,
    help: content.help,
    blocks: [
      renderScreenHeader({ title: content.h1 }),
      // The one earned celebration of the journey, and the only element on
      // this screen with any weight: the answer she came for.
      `
      <section class="tier-reveal">
        <p class="tier-milestone">${content.milestone}</p>
        <p class="tier-badge">${content.tierLabel} <span class="badge-success">Comprobado</span> ${SYNTHETIC_BADGE}</p>
      </section>`,
      `<p class="lede">${content.summary}</p>`,
      `<p class="disclaimer">${content.disclaimer}</p>`,
      renderPrimaryAction({ label: content.ctaLabel }),
    ],
  });
}
