// compareContent.ts
// View model for the before/after split screen. The same three items appear
// on both sides — crossed out and sealed behind one outcome chip on the
// right — so the meaning survives with every label hidden.

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
  readonly leftTitle: string;
  readonly items: readonly CompareItem[];
  readonly counterpartyIcon: string;
  readonly counterpartyLabel: string;
  readonly rightTitle: string;
  readonly outcomeChip: OutcomeChip;
  readonly ctaLabel: string;
}

export function buildCompareContent(): CompareContent {
  return {
    h1: 'Lo que entregas',
    leftTitle: 'Solicitud tradicional',
    items: [
      { icon: '🪪', label: 'Identificación oficial' },
      { icon: '🤳', label: 'Selfie de verificación' },
      { icon: '💰', label: 'Saldo de tu cuenta' },
    ],
    counterpartyIcon: '🏦',
    counterpartyLabel: 'El banco',
    rightTitle: 'Creva ZK',
    outcomeChip: { icon: '✓', label: 'Resultado verificado' },
    ctaLabel: 'Continuar a las ofertas',
  };
}
