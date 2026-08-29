// offersContent.ts
// View model for the final screen: states the proven tier in plain words,
// marks it as the one moment worth celebrating — finding out what she
// qualifies for — and says, just as plainly, that no lending catalogue is
// connected, so no rate or lender exists to show.

import { TIER_LABELS, type Tier } from '../domain/tier';
import type { TechDetail } from './proofScreen';

export interface OffersContent {
  readonly h1: string;
  /** The one earned celebration of the journey: the answer arriving. */
  readonly milestone: string;
  readonly tierLabel: string;
  readonly summary: string;
  readonly disclaimer: string;
  readonly ctaLabel: string;
  readonly tech: TechDetail;
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
    tech: {
      summary: 'Ver el detalle técnico',
      body:
        'El nivel mostrado es el único valor divulgado por el circuito de respaldo, y llega acompañado de la prueba que lo respalda. No hay catálogo detrás: ninguna tasa, acreedor ni cifra aparece en pantalla porque ningún catálogo la produjo. Todos los datos de esta demostración son sintéticos y no pertenecen a ninguna persona real.',
    },
  };
}
