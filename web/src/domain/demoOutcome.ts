// demoOutcome.ts
// The synthetic outcome picker: since api/ is not called, every proof result
// in this app comes from this typed stub, chosen explicitly by the reviewer
// via a labelled "synthetic" control rather than left to chance.

import type { Tier } from './tier';

export type DemoScenario = 'ready' | 'failed' | 'degraded';

export const DEMO_SCENARIOS: readonly DemoScenario[] = ['ready', 'failed', 'degraded'];

export const DEMO_SCENARIO_LABELS: Readonly<Record<DemoScenario, string>> = {
  ready: 'Ready',
  failed: 'Verification failed',
  degraded: 'Degraded',
};

// identity proof outcome: verified is a plain boolean, never a document or
// biometric value — the circuit discloses only the outcome.
export function identityOutcomeFor(scenario: DemoScenario): boolean {
  return scenario === 'ready' || scenario === 'degraded';
}

const DEMO_TIER: Tier = 'silver';

// backing proof outcome: the proven tier, or 'none' when verification failed.
export function backingOutcomeFor(scenario: DemoScenario): Tier {
  if (scenario === 'failed') return 'none';
  return DEMO_TIER;
}
