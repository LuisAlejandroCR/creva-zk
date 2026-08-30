// compareContent.ts
// View model for the before/after split screen. The same three items appear
// on both sides — crossed out and sealed behind one outcome chip on the
// right — so the meaning survives with every label hidden.

import { helpPath } from '../help/helpContent';

export interface CompareItem {
  readonly icon: string;
  readonly label: string;
}

export interface OutcomeChip {
  readonly icon: string;
  readonly label: string;
}

export interface CompareContent {
  readonly h1: string;
  readonly intro: string;
  readonly leftTitle: string;
  readonly items: readonly CompareItem[];
  readonly counterpartyIcon: string;
  readonly counterpartyLabel: string;
  readonly rightTitle: string;
  readonly outcomeChip: OutcomeChip;
  readonly ctaLabel: string;
  readonly help: string;
}

export function buildCompareContent(): CompareContent {
  return {
    // Framed around what she still holds, not around what she failed to
    // hand over: the same screen, read as progress rather than as a shortfall.
    h1: 'Lo que sigue siendo tuyo',
    intro: 'A la izquierda, lo que se pide siempre. A la derecha, lo que diste hoy.',
    leftTitle: 'Como se pide siempre',
    items: [
      { icon: '🪪', label: 'Tu identificación' },
      { icon: '🤳', label: 'Tu selfie' },
      { icon: '💰', label: 'Cuánto tienes' },
    ],
    counterpartyIcon: '🏦',
    counterpartyLabel: 'Se lo queda el banco',
    rightTitle: 'Como fue con Creva',
    outcomeChip: { icon: '✓', label: 'Solo la respuesta' },
    ctaLabel: 'Ver mi resultado',
    help: helpPath('privacidad', 'donde-quedan-mis-datos'),
  };
}
