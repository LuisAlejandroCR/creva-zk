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
        answer:
          'Una respuesta de sí o no, y nada más: ni tu identificación, ni tu foto, ni tus documentos.',
        steps: [
          'Tú abres tu identificación en tu propio teléfono.',
          'Tu teléfono la revisa ahí mismo, sin subirla a ningún lado.',
          'De esa revisión sale una sola cosa: sí eres tú, o no se pudo confirmar.',
          'Eso es lo único que viaja. Lo demás se queda contigo.',
        ],
        note: 'Por eso nunca te vamos a pedir que nos mandes una foto de tu credencial por mensaje.',
        keywords: ['privacidad', 'datos', 'ine', 'identificación', 'foto', 'qué ven'],
      },
      {
        slug: 'sin-ver-mi-saldo',
        question: '¿Cómo saben que califico sin ver mi saldo?',
        answer:
          'Tu teléfono hace la cuenta por dentro y solo comparte el resultado, nunca la cantidad.',
        steps: [
          'Tu respaldo se compara con lo que pediste, dentro de tu teléfono.',
          'De esa comparación sale un nivel: Bronce, Plata u Oro.',
          'Ese nivel es lo único que se comparte.',
          'Cuánto tienes exactamente no se manda a nadie, ni a nosotros.',
        ],
        note: 'Es como enseñar tu credencial para entrar a un lugar: alguien confirma que puedes pasar sin quedarse con tu credencial.',
        keywords: ['saldo', 'cuánto tengo', 'dinero', 'banco', 'no quiero que vean'],
      },
      {
        slug: 'donde-quedan-mis-datos',
        question: '¿Dónde quedan mis datos después?',
        answer: 'Donde estaban: en tu teléfono. No se copian a un servidor nuestro.',
        steps: [
          'Nada de lo que revisó tu teléfono se sube durante la solicitud.',
          'Al terminar, solo queda guardado el resultado que ya viste en pantalla.',
          'Si empiezas de nuevo, la revisión vuelve a hacerse desde cero en tu teléfono.',
        ],
        keywords: ['dónde quedan', 'guardan', 'servidor', 'después', 'borrar'],
      },
      {
        slug: 'si-me-hackean',
        question: 'Si alguien entra a Creva, ¿ve mis documentos?',
        answer: 'No hay nada que ver: tus documentos nunca llegaron a nosotros.',
        note: 'No se puede filtrar algo que nunca se guardó. Esa es la razón de que todo se revise en tu teléfono y no en el nuestro.',
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
        answer: 'Tu identificación oficial y el teléfono que traes en la mano.',
        steps: [
          'Una identificación oficial vigente.',
          'Tu RFC, el mismo que aparece en tu identificación.',
          'Un respaldo, que es lo que garantiza tu tarjeta.',
        ],
        note: 'No necesitas mandar nada por correo ni ir a una sucursal.',
        keywords: ['requisitos', 'qué piden', 'documentos', 'necesito', 'rfc'],
      },
      {
        slug: 'por-que-tarda',
        question: '¿Por qué tarda casi medio minuto?',
        answer:
          'Porque la revisión se hace en tu teléfono, y esa es justo la parte que protege tus datos.',
        steps: [
          'Mandar tus documentos a un servidor sería más rápido.',
          'También significaría que alguien más se queda con ellos.',
          'Hacerlo en tu teléfono cuesta unos segundos más y no le entrega nada a nadie.',
        ],
        note: 'La pantalla de espera te va diciendo en qué paso va, para que no te quedes adivinando.',
        keywords: ['tarda', 'lento', 'se trabó', 'espera', 'cuánto se tarda'],
      },
      {
        slug: 'puedo-cerrar-la-app',
        question: '¿Puedo cerrar la app mientras espera?',
        answer: 'Mejor no: la revisión corre en tu teléfono y se detiene si sales.',
        steps: [
          'Deja la pantalla abierta hasta que aparezca el resultado.',
          'Si la cerraste, no pasa nada malo: vuelve a entrar y empieza otra vez.',
        ],
        resolvedBy: 'El botón de volver a intentarlo, en la misma pantalla.',
        keywords: ['cerrar', 'salir', 'se cortó', 'apagué', 'minimizar'],
      },
      {
        slug: 'afecta-mi-historial',
        question: '¿Esto afecta mi historial crediticio?',
        answer: 'No. Nadie consulta tu historial para darte un resultado aquí.',
        note: 'El resultado sale de tu propio respaldo, no de tu comportamiento de pago pasado.',
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
        answer: 'Es qué tan grande puede ser tu tarjeta según el respaldo que tienes.',
        steps: [
          'Hay tres niveles: Bronce, Plata y Oro.',
          'Entre más respaldo, más alto el nivel al que llegas.',
          'El nivel es lo único que se comparte: nunca de cuánto es tu respaldo.',
        ],
        note: 'No publicamos dónde queda exactamente la línea entre un nivel y otro.',
        keywords: ['nivel', 'bronce', 'plata', 'oro', 'qué significa', 'cuánto me dan'],
      },
      {
        slug: 'puedo-subir-de-nivel',
        question: '¿Puedo subir de nivel?',
        answer: 'Sí: si tu respaldo crece, vuelve a solicitar y el nivel se calcula otra vez.',
        steps: [
          'Aumenta tu respaldo.',
          'Vuelve a empezar la solicitud desde el principio.',
          'La revisión se hace de nuevo y te da el nivel que te toque ahora.',
        ],
        resolvedBy: 'El botón de empezar de nuevo, al final de la solicitud.',
        keywords: ['subir', 'mejorar', 'más límite', 'aumentar', 'siguiente nivel'],
      },
      {
        slug: 'todavia-no-se-puede',
        question: 'Dice "todavía no se puede". ¿Qué hago?',
        answer: 'Quiere decir que con lo que hay hoy aún no alcanza, no que estés vetada.',
        steps: [
          'No es un rechazo permanente ni queda marcado en ningún lado.',
          'Si era por tu respaldo, auméntalo y vuelve a intentar.',
          'Si era por tu identificación, revisa que esté vigente y que el RFC coincida.',
        ],
        note: 'A propósito no te decimos cuál de los requisitos faltó, porque para saberlo tendríamos que haber visto tus datos.',
        keywords: ['no califico', 'me rechazaron', 'no se puede', 'no pasé', 'negado'],
      },
      {
        slug: 'sin-tasas-ni-bancos',
        question: '¿Por qué no veo tasas ni bancos?',
        answer: 'Porque esta versión todavía no está conectada a ninguna oferta real.',
        note: 'Preferimos no mostrarte una tasa a que te enteres después de que era inventada. Cuando haya ofertas de verdad, aparecerán aquí.',
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
        answer: 'No. Quiere decir que la revisión no llegó a hacerse, así que no hay respuesta todavía.',
        steps: [
          'No es un no: es que nadie alcanzó a mirar nada.',
          'Tus datos siguieron en tu teléfono todo el tiempo.',
          'Vuelve a intentarlo; casi siempre es algo momentáneo.',
        ],
        resolvedBy: 'El botón Reintentar, en la misma pantalla.',
        note: 'Nunca te vamos a dejar avanzar como si hubieras calificado cuando en realidad nadie revisó nada.',
        keywords: ['nadie pudo', 'error', 'no funcionó', 'me rechazaron', 'falló'],
      },
      {
        slug: 'falta-la-cartera',
        question: 'Me pide instalar una cartera. ¿Qué es eso?',
        answer:
          'Es una extensión del navegador que guarda tus llaves en tu computadora, como un llavero.',
        steps: [
          'Instala Lace en su versión Midnight Preview, publicada por IOG.',
          'Ábrela y termina de configurarla.',
          'Regresa a esta pantalla y vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, después de instalarla.',
        note: 'Solo hace falta en la versión de escritorio. Nadie más que tú tiene acceso a lo que guarda.',
        keywords: ['cartera', 'wallet', 'lace', 'instalar', 'extensión', 'no la tengo'],
      },
      {
        slug: 'cartera-bloqueada',
        question: 'Dice que mi cartera está bloqueada',
        answer: 'Está instalada, pero cerrada con llave: hay que abrirla y darle permiso a este sitio.',
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
        answer: 'Tu cartera está apuntando a otro lado; hay que cambiarla a la red de prueba.',
        steps: [
          'Abre Lace y ve a sus ajustes de red.',
          'Cámbiala a la red de prueba de Midnight.',
          'Vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, ya con la red cambiada.',
        keywords: ['red', 'network', 'preprod', 'testnet', 'red equivocada'],
      },
      {
        slug: 'servidor-local',
        question: 'Dice que el servidor local no responde',
        answer:
          'Es un programa que corre en tu propia computadora y es el que hace la revisión; no está encendido.',
        steps: [
          'Enciende el servidor local que configuraste en Lace.',
          'Comprueba en los ajustes de Lace que la dirección sea la correcta.',
          'Vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, ya con el servidor encendido.',
        note: 'Que la revisión ocurra en tu computadora y no en la nuestra es a propósito: por eso tus datos no viajan.',
        keywords: ['servidor', 'no responde', 'localhost', 'apagado', 'no arranca'],
      },
      {
        slug: 'falta-un-dato',
        question: 'Dice que a la app le falta un dato. ¿Qué hago?',
        answer:
          'Le falta la dirección del lugar donde se hace la revisión. Eso lo configura quien instaló la app, no tú.',
        steps: [
          'No es algo que hayas hecho mal: la app llegó sin ese dato o el lugar ya no está.',
          'Avísale a quien te compartió la app para que lo corrija.',
          'Cuando te digan que ya está, vuelve a intentarlo.',
        ],
        resolvedBy: 'El botón Reintentar, una vez que quien instaló la app lo corrija.',
        note: 'Aunque falte ese dato, tus datos nunca salieron de este dispositivo: la revisión ni siquiera empezó.',
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
