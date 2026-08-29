// offersContent.ts
// View model for the final screen: states the proven tier in plain words,
// marks it as the one moment worth celebrating — finding out what she
// qualifies for — and says, just as plainly, that no lending catalogue is
// connected, so no rate or lender exists to show.

import { TIER_LABELS, type Tier } from '../domain/tier';
import { helpPath } from '../help/helpContent';

export interface OffersContent {
  readonly h1: string;
  /** The one earned celebration of the journey: the answer arriving. */
  readonly milestone: string;
  readonly tierLabel: string;
  readonly summary: string;
  readonly disclaimer: string;
  readonly ctaLabel: string;
  readonly help: string;
}

export function buildOffersContent(tier: Tier): OffersContent {
  return {
    h1: 'Tu resultado',
    milestone: '🎉 ¡Ya está! Esto es a lo que calificas',
    tierLabel: TIER_LABELS[tier],
    summary:
      'Este es el nivel que quedó comprobado. Para llegar aquí no entregaste tu identificación, tu selfie ni cuánto tienes: nada de eso salió de tu teléfono.',
    disclaimer:
      'Este prototipo no está conectado a ningún catálogo de crédito. Por eso no verás tasas, ni bancos, ni cantidades: solo el nivel que salió de la revisión.',
    ctaLabel: 'Empezar de nuevo',
    help: helpPath('resultado', 'que-es-un-nivel'),
  };
}
