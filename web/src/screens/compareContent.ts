// compareContent.ts
// View model for the before/after split screen. The same three items appear
// on both sides — crossed out and sealed behind one outcome chip on the
// right — so the meaning survives with every label hidden.

import type { TechDetail } from './proofScreen';

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
  readonly tech: TechDetail;
}

export function buildCompareContent(): CompareContent {
  return {
    h1: 'Esto es lo que no entregaste',
    intro:
      'A la izquierda, lo que normalmente hay que dar para pedir una tarjeta. A la derecha, lo que diste hoy.',
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
    tech: {
      summary: 'Ver el detalle técnico',
      body:
        'La columna izquierda es la divulgación completa: el documento, la biometría y el saldo cruzan hacia la contraparte y quedan en su poder. La derecha es lo que las dos pruebas de conocimiento cero divulgan en realidad: un booleano de identidad y un nivel de respaldo. Los testigos privados — documento, fecha de nacimiento, RFC, colateral, saldo — permanecen en el dispositivo y nunca entran en la transcripción de la prueba; el verificador solo recibe la prueba y el resultado del predicado.',
    },
  };
}
