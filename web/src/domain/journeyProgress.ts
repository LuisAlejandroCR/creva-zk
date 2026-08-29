// journeyProgress.ts
// Where she is in the journey, in one compact treatment rather than two
// competing progress messages. Pure: it turns a step number into the counter
// the indicator shows, the sentence a screen reader hears, and the per-step
// states the track is drawn from. Knows nothing about the DOM.

export type StepMark = 'done' | 'current' | 'ahead';

export interface StepProgress {
  /** "1 de 4" — the only progress wording on screen. */
  readonly counter: string;
  /** "Paso 1 de 4: Quién eres" — the accessible name for the whole group. */
  readonly label: string;
  /** What this step is about, named for the step and not for the mechanism. */
  readonly name: string;
  /** One mark per step, so the track is drawn rather than described twice. */
  readonly marks: readonly StepMark[];
  /** 1-based. */
  readonly stepNumber: number;
  readonly totalSteps: number;
}

function markFor(index: number, stepNumber: number): StepMark {
  if (index + 1 < stepNumber) return 'done';
  if (index + 1 === stepNumber) return 'current';
  return 'ahead';
}

export function buildStepProgress(
  stepNumber: number,
  totalSteps: number,
  name: string,
): StepProgress {
  return {
    counter: `${stepNumber} de ${totalSteps}`,
    // The tally the flow used to print beside this ("2 listos · te faltan 2")
    // said the same thing a second time. The track already shows what is
    // behind her; only a screen reader, which cannot see it, is told in words.
    label: `Paso ${stepNumber} de ${totalSteps}: ${name}`,
    name,
    marks: Array.from({ length: totalSteps }, (_, index) => markFor(index, stepNumber)),
    stepNumber,
    totalSteps,
  };
}
