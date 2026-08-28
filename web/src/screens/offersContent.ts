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
    h1: 'Lo que podrías calificar',
    tierLabel: TIER_LABELS[tier],
    disclaimer:
      'Este prototipo no está conectado a ningún catálogo de crédito. No se muestra tasa, acreedor ni cifra alguna — solo el nivel que produjo la prueba de respaldo.',
    ctaLabel: 'Comenzar de nuevo',
  };
}
