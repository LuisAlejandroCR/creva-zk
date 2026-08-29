// helpContent.ts
// The only source of help content: categories, questions, answers. Free of
// markup by design, so migrating it into creva_finance's lib/help-content.ts
// is a copy rather than a rewrite. Never states a threshold, a ratio or a
// tier boundary — that is Creva's business logic, not an explanation.

export interface HelpArticle {
  readonly slug: string;
  /** What she would ask, word for word. Never what we called it internally. */
  readonly question: string;
  /** One line. What she reads before deciding to open anything. */
  readonly answer: string;
  readonly steps?: readonly string[];
  readonly note?: string;
  /** What actually settles it: a button, a screen, a person. */
  readonly resolvedBy?: string;
  /** What she would type into a search box, not what we named the feature. */
  readonly keywords?: readonly string[];
}

export interface HelpCategory {
  readonly slug: string;
  readonly title: string;
  readonly lead: string;
  readonly icon: string;
  readonly articles: readonly HelpArticle[];
}

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    slug: 'privacidad',
    title: 'Qué ve Creva de ti',
    lead: 'Lo que sale de tu teléfono, lo que no sale, y por qué.',
    icon: '🔒',
    articles: [
      {
        slug: 'que-ve-creva',
        question: '¿Qué ve Creva de mí?',
        answer: 'Un sí o un no, nada más. Ni tu identificación, ni tu foto, ni tus documentos.',
        steps: [
          'Abres tu identificación en tu propio teléfono.',
          'El teléfono la revisa ahí mismo. No la sube a ningún lado.',
          'De esa revisión sale una sola cosa: eres tú, o no se pudo confirmar.',
          'Eso es lo único que viaja. Lo demás se queda contigo.',
        ],
        note: 'Por eso nunca te vamos a pedir que mandes una foto de tu credencial por mensaje.',
        keywords: ['privacidad', 'datos', 'ine', 'identificación', 'foto', 'qué ven'],
      },
      {
        slug: 'sin-ver-mi-saldo',
        question: '¿Cómo saben que califico sin ver mi saldo?',
        answer: 'Tu teléfono hace la cuenta por dentro y comparte el resultado, nunca la cantidad.',
        steps: [
          'Tu respaldo es el dinero que dejas guardado para garantizar la tarjeta.',
          'Tu teléfono lo compara con lo que pediste, ahí adentro.',
          'De esa comparación sale un nivel: Bronce, Plata u Oro.',
          'Se comparte el nivel. Cuánto tienes no se manda a nadie, ni a nosotros.',
        ],
        note: 'A esto se le llama prueba de conocimiento cero: comprobar algo sin enseñar el dato que lo comprueba.',
        keywords: ['saldo', 'cuánto tengo', 'dinero', 'banco', 'no quiero que vean'],
      },
      {
        slug: 'donde-quedan-mis-datos',
        question: '¿Dónde quedan mis datos después?',
        answer: 'Donde estaban: en tu teléfono. No se copian a ningún servidor nuestro.',
        steps: [
          'Durante la solicitud no se sube nada de lo que revisó tu teléfono.',
          'Al terminar queda guardado el resultado que ya viste en pantalla, y nada más.',
          'Si empiezas de nuevo, tu teléfono vuelve a revisar todo desde cero.',
        ],
        note: 'Un servidor es una computadora ajena donde se guardan datos. Aquí no usamos ninguno para eso.',
        keywords: ['dónde quedan', 'guardan', 'servidor', 'después', 'borrar'],
      },
      {
        slug: 'si-me-hackean',
        question: 'Si alguien entra a Creva, ¿ve mis documentos?',
        answer: 'No hay nada que ver: tus documentos nunca llegaron hasta nosotros.',
        note: 'No se puede filtrar lo que nunca se guardó. Por eso la revisión ocurre en tu teléfono y no en el nuestro.',
        keywords: ['hackeo', 'robo de datos', 'filtración', 'seguridad', 'me roban'],
      },
    ],
  },
  {
    slug: 'solicitud',
    title: 'Cómo va tu solicitud',
    lead: 'Qué necesitas, cuánto tarda y qué pasa mientras esperas.',
    icon: '📝',
    articles: [
      {
        slug: 'que-necesito',
        question: '¿Qué necesito para solicitar la tarjeta?',
        answer: 'Tu identificación oficial, tu RFC y el respaldo que garantiza la tarjeta.',
        steps: [
          'Una identificación oficial vigente.',
          'Tu RFC, el mismo que aparece en tu identificación.',
          'Tu respaldo: el dinero que dejas guardado para garantizar la tarjeta.',
          'El teléfono que traes en la mano. Ahí se hace todo.',
        ],
        note: 'No mandas nada por correo ni vas a una sucursal.',
        keywords: ['requisitos', 'qué piden', 'documentos', 'necesito', 'rfc'],
      },
      {
        slug: 'por-que-tarda',
        question: '¿Por qué tarda casi medio minuto?',
        answer: 'Porque la revisión corre en tu teléfono, y esa es justo la parte que protege tus datos.',
        steps: [
          'Mandar tus documentos a otra computadora sería más rápido.',
          'También querría decir que alguien más se queda con ellos.',
          'Hacerlo en tu teléfono cuesta unos segundos más y no le entrega nada a nadie.',
        ],
        note: 'La pantalla de espera te va diciendo en qué paso va, para que no te quedes adivinando.',
        keywords: ['tarda', 'lento', 'se trabó', 'espera', 'cuánto se tarda'],
      },
      {
        slug: 'puedo-cerrar-la-app',
        question: '¿Puedo cerrar la app mientras espera?',
        answer: 'Mejor no: la revisión corre en tu teléfono y se detiene si te sales.',
        steps: [
          'Deja la pantalla abierta hasta que salga el resultado.',
          'Si ya la cerraste no pasa nada: vuelve a entrar y empieza otra vez.',
        ],
        resolvedBy: 'El botón para volver a intentarlo, en esa misma pantalla.',
        keywords: ['cerrar', 'salir', 'se cortó', 'apagué', 'minimizar'],
      },
      {
        slug: 'afecta-mi-historial',
        question: '¿Esto afecta mi historial crediticio?',
        answer: 'No. Aquí nadie consulta tu historial para darte un resultado.',
        note: 'El resultado sale de tu propio respaldo, no de cómo has pagado antes.',
        keywords: ['buró', 'historial', 'crédito', 'me afecta', 'puntaje'],
      },
    ],
  },
  {
    slug: 'resultado',
    title: 'Tu resultado',
    lead: 'Qué significa lo que te salió y qué puedes hacer con eso.',
    icon: '🏅',
    articles: [
      {
        slug: 'que-es-un-nivel',
        question: '¿Qué significa el nivel que me salió?',
        answer: 'Es hasta dónde llega tu respaldo. No es una oferta ni un límite aprobado.',
        steps: [
          'Tu respaldo es el dinero que dejas guardado para garantizar la tarjeta.',
          'Hay tres niveles: Bronce, Plata y Oro.',
          'Entre más respaldo, más alto el nivel al que llegas.',
          'Se comparte el nivel, nunca de cuánto es tu respaldo.',
        ],
        note: 'No decimos dónde queda la línea entre un nivel y otro.',
        keywords: ['nivel', 'bronce', 'plata', 'oro', 'qué significa', 'cuánto me dan'],
      },
      {
        slug: 'puedo-subir-de-nivel',
        question: '¿Puedo subir de nivel?',
        answer: 'Sí. Si tu respaldo crece, vuelves a solicitar y el nivel se calcula otra vez.',
        steps: [
          'Aumenta tu respaldo.',
          'Empieza la solicitud otra vez, desde el principio.',
          'La revisión se hace de nuevo y te da el nivel que te toque ahora.',
        ],
        resolvedBy: 'El botón para empezar de nuevo, al final de la solicitud.',
        keywords: ['subir', 'mejorar', 'más límite', 'aumentar', 'siguiente nivel'],
      },
      {
        slug: 'todavia-no-se-puede',
        question: 'Dice "todavía no se puede". ¿Qué hago?',
        answer: 'Quiere decir que hoy todavía no alcanza. No es un rechazo ni queda marcado en ningún lado.',
        steps: [
          'Puedes volver a intentarlo cuando quieras.',
          'Si fue por tu respaldo, auméntalo y vuelve a empezar.',
          'Si fue por tu identificación, revisa que esté vigente y que el RFC coincida.',
        ],
        note: 'No te decimos cuál de los dos falló, y es a propósito: para saberlo tendríamos que haber visto tus datos.',
        keywords: ['no califico', 'me rechazaron', 'no se puede', 'no pasé', 'negado'],
      },
      {
        slug: 'sin-tasas-ni-bancos',
        question: '¿Por qué no veo tasas ni bancos?',
        answer: 'Porque esta versión no está conectada a ninguna oferta real. No hay tasas que mostrar.',
        note: 'Preferimos no enseñarte una tasa antes que enseñarte una inventada. Los datos que ves en pantalla son de ejemplo, y así vienen marcados.',
        keywords: ['tasa', 'interés', 'banco', 'oferta', 'cuánto pago', 'no aparece nada'],
      },
    ],
  },
  {
    slug: 'problemas',
    title: 'Cuando algo no funciona',
    lead: 'Qué significa cada aviso y qué puedes hacer tú.',
    icon: '🛟',
    articles: [
      {
        slug: 'nadie-pudo-revisar',
        question: 'Dice que nadie pudo revisarlo. ¿Me rechazaron?',
        answer: 'No. Quiere decir que la revisión no llegó a hacerse, así que todavía no hay respuesta.',
        steps: [
          'No es un no: nadie alcanzó a mirar nada.',
          'Tus datos se quedaron en tu teléfono todo el tiempo.',
          'Vuelve a intentarlo. Casi siempre es algo del momento.',
        ],
        resolvedBy: 'El botón Reintentar, en esa misma pantalla.',
        note: 'Nunca te vamos a dejar pasar como si hubieras calificado cuando nadie revisó nada.',
        keywords: ['nadie pudo', 'error', 'no funcionó', 'me rechazaron', 'falló'],
      },
      {
        slug: 'falta-la-cartera',
        question: 'Me pide instalar una cartera. ¿Qué es eso?',
        answer: 'Una cartera es un programa del navegador que guarda tus llaves, como un llavero.',
        steps: [
          'Instala Lace en su versión Midnight Preview, la oficial.',
          'Ábrela y termina de configurarla.',
          'Regresa a esta pantalla y vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, ya con la cartera instalada.',
        note: 'Tus llaves son las claves que te identifican en la red, y solo tú las tienes. Esto hace falta nada más en la versión de computadora.',
        keywords: ['cartera', 'wallet', 'lace', 'instalar', 'extensión', 'no la tengo'],
      },
      {
        slug: 'cartera-bloqueada',
        question: 'Dice que mi cartera está bloqueada',
        answer: 'Está instalada, pero cerrada con llave. Ábrela y dale permiso a este sitio.',
        steps: [
          'Abre Lace y desbloquéala.',
          'Autoriza este sitio cuando te lo pregunte.',
          'Vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, ya con la cartera abierta.',
        keywords: ['bloqueada', 'no conecta', 'contraseña', 'lace cerrada', 'permiso'],
      },
      {
        slug: 'red-equivocada',
        question: 'Dice que estoy en la red equivocada',
        answer: 'Tu cartera está apuntando a otro lado. Hay que cambiarla a la red de prueba.',
        steps: [
          'Una red de prueba es una copia del sistema donde nada usa dinero real.',
          'Abre Lace y ve a sus ajustes de red.',
          'Cámbiala a la red de prueba de Midnight.',
          'Vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, ya con la red cambiada.',
        note: 'Este prototipo solo corre en la red de prueba. Nunca toca dinero de verdad.',
        keywords: ['red', 'network', 'preprod', 'testnet', 'red equivocada'],
      },
      {
        slug: 'servidor-local',
        question: 'Dice que el servidor local no responde',
        answer: 'Es un programa que corre en tu propia computadora y hace la revisión. No está encendido.',
        steps: [
          'Enciende el servidor local que configuraste en Lace.',
          'Revisa en los ajustes de Lace que la dirección sea la correcta.',
          'Vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, ya con el servidor encendido.',
        note: 'Que la revisión ocurra en tu computadora y no en la nuestra es a propósito: por eso tus datos no viajan.',
        keywords: ['servidor', 'no responde', 'localhost', 'apagado', 'no arranca'],
      },
      {
        slug: 'falta-un-dato',
        question: 'Dice que a la app le falta un dato. ¿Qué hago?',
        answer: 'Le falta la dirección del lugar donde se hace la revisión. Eso lo configura quien instaló la app.',
        steps: [
          'No hiciste nada mal: la app llegó sin ese dato, o el lugar ya no está.',
          'Avísale a quien te compartió la app para que lo corrija.',
          'Cuando te digan que ya quedó, vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, una vez que lo corrijan.',
        note: 'Aunque falte ese dato, nada tuyo salió de este dispositivo: la revisión ni siquiera empezó.',
        keywords: ['falta un dato', 'no está configurada', 'dirección', 'no encuentra', 'mal instalada'],
      },
    ],
  },
];

export interface HelpLocation {
  readonly category: HelpCategory;
  readonly article: HelpArticle;
}

export function findCategory(categorySlug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((category) => category.slug === categorySlug);
}

export function findArticle(categorySlug: string, articleSlug: string): HelpLocation | undefined {
  const category = findCategory(categorySlug);
  const article = category?.articles.find((entry) => entry.slug === articleSlug);
  return category && article ? { category, article } : undefined;
}

/** Every article, flattened, for the tests and for a future search box. */
export function everyHelpArticle(): readonly HelpLocation[] {
  return HELP_CATEGORIES.flatMap((category) =>
    category.articles.map((article) => ({ category, article })),
  );
}

/** The "category/article" pair a screen's ? points at. */
export function helpPath(categorySlug: string, articleSlug: string): string {
  return `${categorySlug}/${articleSlug}`;
}

/** True when a screen's ? actually lands on an article that exists. */
export function helpPathExists(path: string): boolean {
  const [categorySlug, articleSlug, ...rest] = path.split('/');
  if (rest.length > 0 || !categorySlug || !articleSlug) return false;
  return findArticle(categorySlug, articleSlug) !== undefined;
}
