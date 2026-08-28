// offersContent.ts
// View model for the final screen: states the proven tier and, just as
// plainly, that no lending catalogue is connected — no rate or lender exists
// to show.

import { TIER_LABELS, type Tier } from '../domain/tier';

export interface OffersContent {
  readonly h1: string;
  readonly tierLabel: string;
  readonly disclaimer: string;
  readonly ctaLabel: string;
}

export function buildOffersContent(tier: Tier): OffersContent {
  return {
    h1: 'What you may qualify for',
    tierLabel: TIER_LABELS[tier],
    disclaimer:
      'No lending catalogue is connected to this prototype. No rate, lender, or number is shown — only the tier the backing proof produced.',
    ctaLabel: 'Start over',
  };
}
