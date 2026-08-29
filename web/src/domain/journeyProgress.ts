// journeyProgress.ts
// Where she is in the journey and, just as plainly, what is behind her and
// what is left. Pure: it turns a step number into the two lines the progress
// block renders, and knows nothing about the DOM.

export interface StepProgress {
  /** "Paso 2 de 4 · Tu respaldo" — where she is, named for what it is about. */
  readonly label: string;
  /** "1 listo · te faltan 3" — what is done and what is left. */
  readonly tally: string;
  /** 1-based, for the aria-valuenow the progress block carries. */
  readonly stepNumber: number;
  readonly totalSteps: number;
}

function done(count: number): string {
  return count === 1 ? '1 listo' : `${count} listos`;
}

function left(count: number): string {
  return count === 1 ? 'te falta 1' : `te faltan ${count}`;
}

export function buildStepProgress(
  stepNumber: number,
  totalSteps: number,
  name: string,
): StepProgress {
  const completed = stepNumber - 1;
  // Nothing is behind her yet on the first step, and "0 listos" would be a
  // discouraging first thing to read. It still says how many are left, so
  // every step carries the same half of the sentence.
  const tally =
    completed === 0
      ? `Son ${totalSteps} pasos · ${left(totalSteps)}`
      : `${done(completed)} · ${left(totalSteps - completed)}`;

  return {
    label: `Paso ${stepNumber} de ${totalSteps} · ${name}`,
    tally,
    stepNumber,
    totalSteps,
  };
}
