// compareContent.ts
// Static view model for the before/after split screen. Row counts and icon
// classes are the point: the asymmetry must read even with text hidden.

export interface CompareRow {
  readonly icon: string;
  readonly label: string;
}

export interface CompareContent {
  readonly h1: string;
  readonly leftTitle: string;
  readonly leftRows: readonly CompareRow[];
  readonly rightTitle: string;
  readonly rightRows: readonly CompareRow[];
  readonly ctaLabel: string;
}

export function buildCompareContent(): CompareContent {
  return {
    h1: 'What you hand over',
    leftTitle: 'A normal application',
    leftRows: [
      { icon: '📄', label: 'ID scan' },
      { icon: '🧾', label: 'Pay stubs' },
      { icon: '🏦', label: 'Bank statements' },
      { icon: '💰', label: 'Full account balance' },
      { icon: '🏠', label: 'Home address' },
      { icon: '📞', label: 'Phone number' },
    ],
    rightTitle: 'Creva ZK',
    rightRows: [
      { icon: '🔒', label: 'A verified check' },
      { icon: '🔒', label: 'A proven tier' },
    ],
    ctaLabel: 'Continue to offers',
  };
}
