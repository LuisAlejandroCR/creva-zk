Sistema de diseño de Creva ZK, escrito para que un agente genere interfaz
consistente sin abrir el CSS. La fuente de verdad es `web/src/style.css`, que
a su vez porta los tokens de `creva_finance/frontend/app/globals.css`. Los
valores de aquí se leyeron de ese archivo; las razones de contraste se
calcularon, no se estimaron. Nombres de token en inglés, prosa en español.

# Sistema de diseño — Creva ZK

## Reglas que no se negocian

1. **No inventes un color.** Si el valor que necesitas no está en la tabla de
   tokens, no existe. Usa el token semántico más cercano.
2. **El crimson de marca no es tinta sobre superficie oscura.** `--cr-crimson`
   mide 2.70–3.16:1 sobre las tres superficies del tema oscuro. Para texto en
   ese tono usa `--cr-danger-text`, que aclara los dos temas. Ver
   [Contraste](#contraste).
3. **Todo texto cumple AA (4.5:1).** La tabla de contraste dice qué tinta va
   sobre qué superficie. Tres combinaciones están prohibidas y aparecen
   marcadas.
4. **Ningún control por debajo de 44 px** de alto o de área táctil.
5. **Toda animación se cronometra con los tokens de motion**, nunca con un
   número suelto, y respeta `prefers-reduced-motion`.

## Paleta

### Marca

| Token | Valor | Para qué |
| --- | --- | --- |
| `--cr-crimson` | `#C41E3A` | Acento y bordes. **Como tinta, solo en tema claro.** |
| `--cr-crimson-dark` | `#9E1329` | Extremo oscuro del degradado. |
| `--cr-gradient` | `linear-gradient(135deg, #D62E52 0%, #9E1329 100%)` | Fondo de la acción principal. |
| `--cr-on-brand` | `#FFFFFF` | Tinta sobre el degradado. |
| `--cr-inactive` | `#DED7C8` | Estado apagado: pistas, botón deshabilitado. |
| `--cr-obsidian` | `#17130F` | Tinta sobre `--cr-inactive`. Mismo valor en los dos temas. |
| `--cr-shadow-brand-sm` | `0 8px 24px rgba(158, 19, 41, 0.24)` | La única sombra del sistema. |

El botón deshabilitado va sobre `--cr-inactive` con tinta `--cr-obsidian`
(12.9:1 en los dos temas). **Nunca** se atenúa el degradado con `opacity`:
a 0.45 se lava a rosa y la tinta clara cae a 2.06:1.

### Superficies y tinta — dos temas

El tema claro es el predeterminado. El oscuro llega por dos caminos que solo
escriben tinta, así que no pueden contradecirse: la clase `.dark` en la raíz
(el mecanismo del host) y `@media (prefers-color-scheme: dark)` para cuando no
hay host. Para forzar claro sobre un sistema oscuro se pone `.light` en la
raíz. Los dos bloques deben quedar idénticos; `theme-mechanism.spec.ts` falla
si se separan.

| Token | Claro | Oscuro | Rol |
| --- | --- | --- | --- |
| `--cr-bg` | `#F6F1E7` | `#17130F` | Fondo de página. |
| `--cr-surface-1` | `#FFFFFF` | `#211B16` | Tarjeta, píldora, control. |
| `--cr-surface-2` | `#FFE8EE` | `#2A2118` | Superficie de énfasis. |
| `--cr-text` | `#1A1613` | `#F6F1E7` | Tinta dominante. |
| `--cr-text-secondary` | `#6F675C` | `#8A8175` | **Solo sobre `--cr-bg`.** Ver contraste. |
| `--cr-text-muted` | `rgba(26,22,19,.72)` | `rgba(246,241,231,.72)` | Tinta secundaria segura en todo. |
| `--cr-text-subtle` | `rgba(26,22,19,.60)` | `rgba(246,241,231,.58)` | **No sobre `--cr-surface-2` en claro.** |
| `--cr-border` | `rgba(26,22,19,.10)` | `rgba(246,241,231,.08)` | Bordes. |

### Familias semánticas

El fondo y el borde son idénticos en los dos temas; solo la tinta cambia.

| Rol | Fondo | Borde | Tinta claro | Tinta oscuro |
| --- | --- | --- | --- | --- |
| Éxito | `--cr-success-bg` | `--cr-success-border` | `#2E6A48` | `#4ade80` |
| Peligro | `--cr-danger-bg` | `--cr-danger-border` | `#C41E3A` | `#FF8FAE` |
| Aviso | `--cr-warning-bg` | `--cr-warning-border` | `#8A5A00` | `#fbbf24` |
| Información | `--cr-info-bg` | `--cr-info-border` | `#3A5FD8` | `#93b4ff` |

Los fondos son translúcidos (`rgba`, alfa 0.10–0.15), así que **componen con
lo que tengan debajo**. Una tinta semántica sobre su propio tinte queda en
familia de tono y suele caer por debajo de AA: sobre esos tintes la tinta se
pone neutra (`--cr-text`) y el tinte carga el significado. Eso ya pasó con
`.disclaimer` (4.27:1), `.compare-counterparty` (4.30:1) y `.badge-success`
sobre `--cr-surface-2` (4.47:1).

## Contraste

Razones calculadas con la fórmula de luminancia relativa de WCAG 2, con el
alfa de cada tinta compuesto sobre la superficie. `ok` = cumple AA para texto
normal (4.5:1).

### Tema claro

| Tinta | sobre `--cr-bg` | sobre `--cr-surface-1` | sobre `--cr-surface-2` |
| --- | --- | --- | --- |
| `--cr-text` | 15.97 ok | 17.98 ok | 15.43 ok |
| `--cr-text-secondary` | 4.95 ok | 5.57 ok | 4.78 ok |
| `--cr-text-muted` | 6.74 ok | 7.15 ok | 6.62 ok |
| `--cr-text-subtle` | 4.52 ok | 4.70 ok | **4.47 NO** |
| `--cr-success-text` | 5.70 ok | 6.42 ok | 5.51 ok |
| `--cr-warning-text` | 5.27 ok | 5.93 ok | 5.09 ok |
| `--cr-danger-text` | 5.19 ok | 5.84 ok | 5.02 ok |
| `--cr-info-text` | 4.90 ok | 5.51 ok | 4.73 ok |
| `--cr-crimson` | 5.19 ok | 5.84 ok | 5.02 ok |

### Tema oscuro

| Tinta | sobre `--cr-bg` | sobre `--cr-surface-1` | sobre `--cr-surface-2` |
| --- | --- | --- | --- |
| `--cr-text` | 16.41 ok | 15.13 ok | 14.03 ok |
| `--cr-text-secondary` | 4.82 ok | **4.44 NO** | **4.12 NO** |
| `--cr-text-muted` | 8.84 ok | 8.36 ok | 7.91 ok |
| `--cr-text-subtle` | 6.11 ok | 5.89 ok | 5.64 ok |
| `--cr-success-text` | 10.60 ok | 9.77 ok | 9.07 ok |
| `--cr-warning-text` | 11.07 ok | 10.20 ok | 9.46 ok |
| `--cr-danger-text` | 8.62 ok | 7.94 ok | 7.37 ok |
| `--cr-info-text` | 8.99 ok | 8.28 ok | 7.68 ok |
| `--cr-crimson` | **3.16 NO** | **2.91 NO** | **2.70 NO** |

### Las tres prohibiciones

1. **`--cr-crimson` como tinta en tema oscuro.** Falla en las tres
   superficies. Usa `--cr-danger-text`, que es el mismo tono resuelto por
   tema y aclara los dos. Esta regla la descubrió una cifra en crimson dentro
   de una píldora: 2.91:1 sobre `--cr-surface-1`.
2. **`--cr-text-secondary` sobre `--cr-surface-1` o `--cr-surface-2` en tema
   oscuro.** Sirve sobre `--cr-bg` y nada más. Sobre tarjeta usa
   `--cr-text-muted`.
3. **`--cr-text-subtle` sobre `--cr-surface-2` en tema claro.** Usa
   `--cr-text-muted`.

`--cr-text-muted` aclara las seis combinaciones. Cuando dudes, esa es la
tinta secundaria.

### Cómo se verifica

Con axe-core (regla `color-contrast`) sobre la app corriendo, en los dos
temas y en 320/375/390 px. Dos advertencias que cuestan tiempo:

- **axe no compone la opacidad del ancestro.** Un bloque con `opacity: 0.6`
  se mide como si fuera opaco y axe reporta "sin violaciones" aunque el texto
  esté en 2.85:1. Por eso este sistema **no atenúa con opacidad**: para que
  algo pase a segundo plano se cambia de superficie o de token, no de alfa.
- **Mide con el movimiento asentado.** Un fade a medio camino da una razón
  que nadie ve nunca. Corre la auditoría con `prefers-reduced-motion`.

## Tipografía

| Token | Familia | Para qué |
| --- | --- | --- |
| `--font-playfair` | `'Montserrat', Georgia, serif` | Títulos, cifras, cualquier número que sea el dato. |
| `--font-inter` | `'Manrope', system-ui, sans-serif` | Todo lo demás. |

Los nombres de variable vienen de `layout.tsx` de creva_finance y no
corresponden a las familias que cargan; se conservan para que el port sea
copia y no reescritura.

### Escala

| Rol | Tamaño | Peso | Familia | Notas |
| --- | --- | --- | --- | --- |
| `h1` | `clamp(1.7rem, 7vw, 2.15rem)` | 800 | playfair | `letter-spacing: -0.02em`, `line-height: 1.12`. Uno por pantalla. |
| Cifra grande | `1.9rem` | 800 | playfair | `font-variant-numeric: tabular-nums` si cambia en vivo. |
| Lede | `0.95rem` | 400 | inter | `line-height: 1.55`, `max-width: 34em`. |
| Cuerpo | `0.88rem` | 400 | inter | `line-height: 1.5`. |
| Secundario | `0.82rem` | 400 | inter | `line-height: 1.45`. |
| Etiqueta / eyebrow | `0.7rem` | 700–800 | inter | Versalitas, `letter-spacing: 0.06em`. |

La marca es la excepción a "los títulos van en playfair a tamaño grande":
`0.85rem` / 800 / playfair, porque es una firma, no un encabezado.

## Espaciado

Múltiplos de `0.05rem` sobre una base práctica de `0.4 / 0.5 / 0.6 / 0.75 /
0.9 / 1.25 rem`. Los que más se repiten:

| Uso | Valor |
| --- | --- |
| Gap entre glifo y texto | `0.4rem` – `0.5rem` |
| Gap entre bloques de una tarjeta | `0.6rem` – `0.75rem` |
| Padding de tarjeta / píldora | `0.75rem 0.9rem` – `0.9rem` |
| Padding del contenedor | `1.25rem 1rem 1.75rem` |
| Ancho del contenedor | `min(480px, 100%)`, `min(520px, 100%)` desde 600 px |

## Radios

| Valor | Para qué |
| --- | --- |
| `999px` | Píldoras, insignias, anillos, barras de progreso. |
| `20px` | Insignia con texto. |
| `14px` | Tarjeta, botón principal, panel. El radio por defecto. |
| `12px` | Bloque interior dentro de una tarjeta. |
| `10px` | Foco visible sobre un elemento sin radio propio. |

## Sombras

Solo hay una: `--cr-shadow-brand-sm`. Se usa en la marca y en cualquier
elemento que flote sobre el flujo. Nada más lleva sombra; la separación la dan
`--cr-border` y el cambio de superficie.

## Motion

| Token | Valor | Para qué |
| --- | --- | --- |
| `--cr-ease` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | La única curva. |
| `--cr-dur-fast` | `140ms` | Hover, foco, cambio de estado de un control. |
| `--cr-dur` | `240ms` | Entrada y salida de un elemento, cambio de estado con significado. |
| `--cr-dur-slow` | `420ms` | Llegada de una pantalla, revelación de un resultado. |

Reglas:

- Toda `transition` y toda `animation` se escribe con `var(--cr-ease)` y un
  token `--cr-dur*`. La única excepción documentada es un relleno que reporta
  tiempo transcurrido: ese va `linear`, porque suavizarlo reportaría un tiempo
  falso.
- El movimiento marca un cambio de estado. Nada se mueve de adorno.
- **`prefers-reduced-motion: reduce` colapsa duración y retardo.** Colapsar
  solo la duración deja cualquier elemento escalonado sosteniendo su
  fotograma inicial — que en un fade es "invisible" — durante todo el retardo.

## Componentes

Los componentes viven en `web/src/ui/` y se exportan por `web/src/ui/index.ts`.
Una pantalla se arma con ellos; no escribe marcado propio.

| Módulo | Qué da |
| --- | --- |
| `shell.ts` | `OnboardingShell`, indicador de paso, encabezado de pantalla, y los seis arquetipos. |
| `marks.ts` | Las marcas SVG por arquetipo. Siempre `aria-hidden`. |
| `actions.ts` | Acción principal y secundaria. |
| `statusState.ts` | El bloque de resultado, por tono semántico. |
| `verification.ts` | El estado de trabajo en curso. |
| `notices.ts` | Aviso de seguridad, botón de ayuda, estado del sistema. |
| `progressMoment.ts` | El micro-momento que sale de la franja durante una espera. |
| `momentVisual.ts` | Los iconos de esos momentos. |

### Iconos

Un solo idioma, el mismo de las filas de ajustes de Creva: glifo de línea sobre
chip circular.

| Qué | Valor |
| --- | --- |
| Lienzo | `viewBox="0 0 24 24"`, dibujado a 24 px |
| Trazo | `stroke-width: 1.75`, `stroke="currentColor"`, `fill="none"` |
| Remates | `stroke-linecap="round"`, `stroke-linejoin="round"` |
| Chip | círculo de 44 px, `background: var(--cr-surface-2)` |
| Tinta | `color: var(--cr-danger-text)` — nunca `--cr-crimson`, ver prohibición 1 |

El chip va `aria-hidden`: el título de al lado ya dice lo mismo en palabras. Un
glifo que carga significado es un gráfico, y por WCAG 1.4.11 necesita 3:1
contra su fondo — otra razón por la que la tinta es `--cr-danger-text` y no la
marca: `--cr-crimson` mide 2.91:1 sobre `--cr-surface-1` en tema oscuro.

Los iconos se dibujan en este repositorio. No se importa una librería.

### Arquetipos de pantalla

`intro`, `verifying`, `confirm`, `recover`, `compare`, `celebrate`. La pantalla
elige uno y de ahí salen el espaciado, el elemento focal y el peso de todo lo
demás. No se escribe CSS por pantalla.

## Accesibilidad

- **Un `h1` por pantalla.** Cero desbordamiento horizontal en 320/375/390 px.
- **Ningún glifo carga el significado solo.** Una marca, un ✓ o un color van
  siempre acompañados de la palabra que dicen lo mismo. Por eso las marcas son
  `aria-hidden`: el texto de al lado ya lo anuncia.
- **El nombre accesible es texto real**, no `aria-label`, para que aparezca en
  hover, en toque y en foco de teclado por igual.
- **`role="status"` con `aria-live="polite"`** para lo que aparece solo y se va
  solo. Nunca `assertive`: no interrumpe una frase a medias.
- **Nada que la usuaria necesite para continuar vive dentro de algo efímero.**
  Si un elemento se va solo, la acción siguiente queda visible y alcanzable
  todo el tiempo que estuvo en pantalla.
- **Foco visible** con `outline: 2px solid var(--cr-crimson)` y
  `outline-offset: 2px`.

## Idioma

La interfaz es solo en español; nunca se mezclan idiomas en una pantalla.
`i18n.spec.ts` renderiza cada pantalla en cada estado y falla si se cuela una
palabra en inglés. Los identificadores de código, los nombres de token y los
comentarios van en inglés.
