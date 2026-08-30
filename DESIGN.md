Creva ZK's design system, written so an agent can generate consistent
interface without opening the CSS. The source of truth is `web/src/style.css`,
which in turn ports the tokens from `creva_finance/frontend/app/globals.css`.
The values here were read out of that file; the contrast ratios were
calculated, not estimated.

# Design system — Creva ZK

## Rules that are not negotiable

1. **Do not invent a color.** If the value you need is not in the token table,
   it does not exist. Use the nearest semantic token.
2. **The brand crimson is not ink on a dark surface.** `--cr-crimson` measures
   2.70–3.16:1 against all three dark-theme surfaces. For text in that hue use
   `--cr-danger-text`, which resolves lighter in both themes. See
   [Contrast](#contrast).
3. **All text meets AA (4.5:1).** The contrast table says which ink goes on
   which surface. Three combinations are forbidden and are marked as such.
4. **No control below 44 px** in height or touch area.
5. **Every animation is timed with the motion tokens**, never with a loose
   number, and respects `prefers-reduced-motion`.

## Palette

### Brand

| Token | Value | What for |
| --- | --- | --- |
| `--cr-crimson` | `#C41E3A` | Accent and borders. **As ink, light theme only.** |
| `--cr-crimson-dark` | `#9E1329` | Dark end of the gradient. |
| `--cr-gradient` | `linear-gradient(135deg, #D62E52 0%, #9E1329 100%)` | Background of the primary action. |
| `--cr-on-brand` | `#FFFFFF` | Ink on the gradient. |
| `--cr-inactive` | `#DED7C8` | Off state: hints, disabled button. |
| `--cr-obsidian` | `#17130F` | Ink on `--cr-inactive`. Same value in both themes. |
| `--cr-shadow-brand-sm` | `0 8px 24px rgba(158, 19, 41, 0.24)` | The system's only shadow. |

The disabled button sits on `--cr-inactive` with `--cr-obsidian` ink (12.9:1 in
both themes). The gradient is **never** dimmed with `opacity`: at 0.45 it
washes out to pink and the light ink falls to 2.06:1.

### Surfaces and ink — two themes

The light theme is the default. Dark arrives through two paths that only write
ink, so they cannot contradict each other: the `.dark` class on the root (the
host's mechanism) and `@media (prefers-color-scheme: dark)` for when there is
no host. To force light on a dark system, put `.light` on the root. The two
blocks must stay identical; `theme-mechanism.spec.ts` fails if they drift.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--cr-bg` | `#F6F1E7` | `#17130F` | Page background. |
| `--cr-surface-1` | `#FFFFFF` | `#211B16` | Card, pill, control. |
| `--cr-surface-2` | `#FFE8EE` | `#2A2118` | Emphasis surface. |
| `--cr-text` | `#1A1613` | `#F6F1E7` | Dominant ink. |
| `--cr-text-secondary` | `#6F675C` | `#8A8175` | **On `--cr-bg` only.** See contrast. |
| `--cr-text-muted` | `rgba(26,22,19,.72)` | `rgba(246,241,231,.72)` | Secondary ink, safe everywhere. |
| `--cr-text-subtle` | `rgba(26,22,19,.60)` | `rgba(246,241,231,.58)` | **Not on `--cr-surface-2` in light.** |
| `--cr-border` | `rgba(26,22,19,.10)` | `rgba(246,241,231,.08)` | Borders. |

### Semantic families

Background and border are identical in both themes; only the ink changes.

| Role | Background | Border | Light ink | Dark ink |
| --- | --- | --- | --- | --- |
| Success | `--cr-success-bg` | `--cr-success-border` | `#2E6A48` | `#4ade80` |
| Danger | `--cr-danger-bg` | `--cr-danger-border` | `#C41E3A` | `#FF8FAE` |
| Warning | `--cr-warning-bg` | `--cr-warning-border` | `#8A5A00` | `#fbbf24` |
| Info | `--cr-info-bg` | `--cr-info-border` | `#3A5FD8` | `#93b4ff` |

The backgrounds are translucent (`rgba`, alpha 0.10–0.15), so they **compose
with whatever is underneath**. A semantic ink on its own tint stays in the same
hue family and usually falls below AA: on those tints the ink goes neutral
(`--cr-text`) and the tint carries the meaning. That already happened with
`.disclaimer` (4.27:1), `.compare-counterparty` (4.30:1) and `.badge-success`
on `--cr-surface-2` (4.47:1).

## Contrast

Ratios calculated with WCAG 2's relative-luminance formula, with each ink's
alpha composited over the surface. `ok` = meets AA for normal text (4.5:1).

### Light theme

| Ink | on `--cr-bg` | on `--cr-surface-1` | on `--cr-surface-2` |
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

### Dark theme

| Ink | on `--cr-bg` | on `--cr-surface-1` | on `--cr-surface-2` |
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

### The three prohibitions

1. **`--cr-crimson` as ink in the dark theme.** It fails on all three
   surfaces. Use `--cr-danger-text`, which is the same hue resolved per theme
   and lightens both. This rule was found by a crimson figure inside a pill:
   2.91:1 on `--cr-surface-1`.
2. **`--cr-text-secondary` on `--cr-surface-1` or `--cr-surface-2` in the dark
   theme.** It works on `--cr-bg` and nowhere else. On a card use
   `--cr-text-muted`.
3. **`--cr-text-subtle` on `--cr-surface-2` in the light theme.** Use
   `--cr-text-muted`.

`--cr-text-muted` clears all six combinations. When in doubt, that is the
secondary ink.

### How it is verified

With axe-core (the `color-contrast` rule) over the running app, in both themes
and at 320/375/390 px. Two warnings that cost time:

- **axe does not compose an ancestor's opacity.** A block with `opacity: 0.6`
  is measured as if it were opaque, and axe reports "no violations" even
  though the text sits at 2.85:1. That is why this system **does not dim with
  opacity**: to push something back, change surface or token, not alpha.
- **Measure with motion settled.** A fade caught halfway gives a ratio nobody
  ever sees. Run the audit under `prefers-reduced-motion`.

## Typography

| Token | Family | What for |
| --- | --- | --- |
| `--font-playfair` | `'Montserrat', Georgia, serif` | Titles, figures, any number that *is* the datum. |
| `--font-inter` | `'Manrope', system-ui, sans-serif` | Everything else. |

The variable names come from creva_finance's `layout.tsx` and do not match the
families that actually load; they are kept so the port stays a copy rather
than a rewrite.

### Scale

| Role | Size | Weight | Family | Notes |
| --- | --- | --- | --- | --- |
| `h1` | `clamp(1.7rem, 7vw, 2.15rem)` | 800 | playfair | `letter-spacing: -0.02em`, `line-height: 1.12`. One per screen. |
| Large figure | `1.9rem` | 800 | playfair | `font-variant-numeric: tabular-nums` if it changes live. |
| Lede | `0.95rem` | 400 | inter | `line-height: 1.55`, `max-width: 34em`. |
| Body | `0.88rem` | 400 | inter | `line-height: 1.5`. |
| Secondary | `0.82rem` | 400 | inter | `line-height: 1.45`. |
| Label / eyebrow | `0.7rem` | 700–800 | inter | Small caps, `letter-spacing: 0.06em`. |

The brand mark is the exception to "titles are playfair at a large size":
`0.85rem` / 800 / playfair, because it is a signature, not a heading.

## Spacing

Multiples of `0.05rem` over a practical base of `0.4 / 0.5 / 0.6 / 0.75 /
0.9 / 1.25 rem`. The ones that repeat most:

| Use | Value |
| --- | --- |
| Gap between glyph and text | `0.4rem` – `0.5rem` |
| Gap between blocks inside a card | `0.6rem` – `0.75rem` |
| Card / pill padding | `0.75rem 0.9rem` – `0.9rem` |
| Container padding | `1.25rem 1rem 1.75rem` |
| Container width | `min(480px, 100%)`, `min(520px, 100%)` from 600 px |

## Radii

| Value | What for |
| --- | --- |
| `999px` | Pills, badges, rings, progress bars. |
| `20px` | Badge with text. |
| `14px` | Card, primary button, panel. The default radius. |
| `12px` | Inner block inside a card. |
| `10px` | Visible focus on an element with no radius of its own. |

## Shadows

There is exactly one: `--cr-shadow-brand-sm`. It is used on the brand mark and
on anything that floats above the flow. Nothing else carries a shadow;
separation comes from `--cr-border` and from a change of surface.

## Motion

| Token | Value | What for |
| --- | --- | --- |
| `--cr-ease` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | The only curve. |
| `--cr-dur-fast` | `140ms` | Hover, focus, a control changing state. |
| `--cr-dur` | `240ms` | An element entering or leaving, a state change that means something. |
| `--cr-dur-slow` | `420ms` | A screen arriving, a result being revealed. |

Rules:

- Every `transition` and every `animation` is written with `var(--cr-ease)` and
  a `--cr-dur*` token. The one documented exception is a fill that reports
  elapsed time: that one is `linear`, because easing it would report a false
  time.
- Motion marks a change of state. Nothing moves as decoration.
- **`prefers-reduced-motion: reduce` collapses duration *and* delay.**
  Collapsing only the duration leaves any staged element holding its first
  frame — which in a fade is "invisible" — for the whole delay.

## Components

Components live in `web/src/ui/` and are exported from `web/src/ui/index.ts`.
A screen is assembled from them; it does not write markup of its own.

| Module | What it provides |
| --- | --- |
| `shell.ts` | `OnboardingShell`, step indicator, screen header, and the six archetypes. |
| `marks.ts` | The SVG marks per archetype. Always `aria-hidden`. |
| `actions.ts` | Primary and secondary action. |
| `statusState.ts` | The result block, by semantic tone. |
| `verification.ts` | The work-in-progress state. |
| `notices.ts` | Security notice, help button, system status. |
| `progressMoment.ts` | The micro-moment that emerges from the strip during a wait. |
| `momentVisual.ts` | The icons for those moments. |

### Icons

One vocabulary, the same as Creva's settings rows: a line glyph on a circular
chip.

| What | Value |
| --- | --- |
| Canvas | `viewBox="0 0 24 24"`, drawn at 24 px |
| Stroke | `stroke-width: 1.75`, `stroke="currentColor"`, `fill="none"` |
| Caps | `stroke-linecap="round"`, `stroke-linejoin="round"` |
| Chip | 44 px circle, `background: var(--cr-surface-2)` |
| Ink | `color: var(--cr-danger-text)` — never `--cr-crimson`, see prohibition 1 |

The chip is `aria-hidden`: the title beside it already says the same thing in
words. A glyph that carries meaning is a graphic, and WCAG 1.4.11 requires 3:1
against its background — another reason the ink is `--cr-danger-text` and not
the brand color: `--cr-crimson` measures 2.91:1 on `--cr-surface-1` in the dark
theme.

The icons are drawn in this repository. No icon library is imported.

### Screen archetypes

`intro`, `verifying`, `confirm`, `recover`, `compare`, `celebrate`. A screen
picks one, and from it come the spacing, the focal element and the weight of
everything else. No CSS is written per screen.

## Accessibility

- **One `h1` per screen.** Zero horizontal overflow at 320/375/390 px.
- **No glyph carries meaning on its own.** A mark, a ✓ or a color is always
  accompanied by the word that says the same thing. That is why the marks are
  `aria-hidden`: the text beside them already announces it.
- **The accessible name is real text**, not `aria-label`, so it shows up on
  hover, on touch and on keyboard focus alike.
- **`role="status"` with `aria-live="polite"`** for anything that appears and
  leaves on its own. Never `assertive`: it must not interrupt a sentence
  mid-way.
- **Nothing she needs in order to continue lives inside something ephemeral.**
  If an element leaves on its own, the next action stays visible and reachable
  for the whole time it was on screen.
- **Visible focus** with `outline: 2px solid var(--cr-crimson)` and
  `outline-offset: 2px`.

## Language

The interface is Spanish-only; languages are never mixed on one screen.
`i18n.spec.ts` renders every screen in every state and fails if an English word
slips in. Code identifiers, token names and comments are in English, and so is
this document.
