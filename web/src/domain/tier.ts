// tier.ts
// The backing outcome type, defined locally as a stub — api/ is mid-fix and
// out of scope. Mirrors advisor/src/types.ts's Tier without importing it.

export type Tier = 'none' | 'bronze' | 'silver' | 'gold';

const KNOWN_TIERS: ReadonlySet<string> = new Set<Tier>(['none', 'bronze', 'silver', 'gold']);

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && KNOWN_TIERS.has(value);
}

// Labels are Spanish-only: Creva ships for Mexican entrepreneurs, and the
// interface never mixes languages.
export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  none: 'Sin nivel',
  bronze: 'Bronce',
  silver: 'Plata',
  gold: 'Oro',
};
