// financialFacts.ts
// The copy for every progress moment, and the only place it lives: the
// component renders whatever this module hands it. One entry per step, in the
// journey's own order, with the cadence the flow reads by.
//
// Every figure here carries its primary source and the date it was checked.
// A moment with no figure it could source carries none: it says something
// true without one instead.

export type ProgressMomentVariant =
  | 'encouragement' // no figure: what she just did, said back to her
  | 'financialFact' // one figure, with its source on screen
  | 'milestone' // the structural point, which needs no figure to land
  | 'finalCelebration'; // the end of the journey

export interface ProgressMoment {
  /** Which step's completion this belongs to, 1-based. */
  readonly step: number;
  readonly variant: ProgressMomentVariant;
  /** Two or three words above the title. Optional. */
  readonly eyebrow?: string;
  /** Two to four words. It is a popover, not a headline. */
  readonly title: string;
  /** One sentence, and it has to fit two lines at 320px. */
  readonly body: string;
  /** Where the figure comes from, as it appears on screen. Required wherever
   *  the body states a figure, and meaningless without one — a test enforces
   *  both directions. */
  readonly source?: string;
}

// The four moments, one per step, in order.
//
// The cadence is deliberate: a figure after step 1, nothing but her own
// progress after step 2, the structural point after step 3, and the end of
// the journey after step 4. She finishes having read one figure, not four.
export const PROGRESS_MOMENTS: readonly ProgressMoment[] = [
  {
    step: 1,
    variant: 'financialFact',
    eyebrow: 'Un dato',
    title: 'Casi la mitad',
    // INEGI, Comunicado de prensa 62/25, ENAFIN 2024, 28 de mayo de 2025.
    // https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/enafin/ENAFIN_24.pdf
    // Verificada en fuente primaria el 2026-08-29.
    //
    // 42.3 % de las empresas donde una mujer es dueña o socia mayoritaria ha
    // tenido financiamiento alguna vez; 47.4 % cuando el dueño o socio
    // mayoritario es hombre. El verbo es el del texto del comunicado —"ha
    // tenido financiamiento"— y no el de la gráfica, que dice "solicitado":
    // haber solicitado y haber tenido no son la misma medida.
    //
    // La comparación con 47.4 % no cabe en dos líneas a 320 px junto con la
    // medida completa, y la medida completa es lo que no se puede recortar:
    // "empresas lideradas por mujeres" sería otra cosa. El encabezado carga
    // el encuadre en su lugar, y la cifra de hombres queda aquí, en la cita.
    body: '42.3% de las empresas con dueña o socia mayoritaria ha tenido financiamiento.',
    source: 'INEGI · ENAFIN 2024',
  },
  {
    step: 2,
    variant: 'encouragement',
    title: 'Eso también cuenta',
    body: 'Estás construyendo una historia que habla de tu negocio, no solo de tus datos.',
  },
  {
    step: 3,
    variant: 'milestone',
    eyebrow: 'Vas avanzando',
    // No figure, on purpose. The structural point is the strongest moment of
    // the flow and it does not need one: it is about how the system reads,
    // not about how many. Any figure that could have gone here would need its
    // own primary source, and none was available to check.
    title: 'Tu negocio ya vale',
    body: 'Lo difícil suele ser entender qué te piden, y Creva empieza por hacerlo claro.',
  },
  {
    step: 4,
    variant: 'finalCelebration',
    eyebrow: 'Ya está',
    title: 'Ya eres parte',
    body: 'Identidad y nivel comprobados, sin haber entregado nada de lo tuyo.',
  },
];

export function momentForStep(step: number): ProgressMoment | undefined {
  return PROGRESS_MOMENTS.find((moment) => moment.step === step);
}
