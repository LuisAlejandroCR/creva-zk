<!--
  README.md
  Acceptance criteria for the web/ screen journey, written before the
  screens were built and revised when the journey was rewritten for plain
  language, plus what a reviewer must have installed to exercise the
  browser-direct (Lace) proof path. Update this file if a criterion changes.
-->

# Creva ZK — web screen journey

## Scope

Every proof outcome on screen comes from a `@creva-zk/api` port, chosen by
the seam in `src/proofPort.ts`. There is one stub and it lives behind that
port; `src/domain/demoInputs.ts` holds only the synthetic *inputs* a call is
made with. No screen decides an outcome for itself.

## Acceptance criteria

1. **Journey.** "Solicita tu tarjeta" (identity) → "Descubre a qué
   calificas" (backing) → a before/after comparison → a result screen. The
   identity and backing screens each expose one primary action, whose label
   changes with proof phase. No two steps share a button label, and none of
   them says "Continuar": each names what happens next — *Solicita la
   tarjeta* → *Ver a qué califico* → *Ver qué compartí* → *Ver mi resultado*
   → *Empezar de nuevo*. This README stays in English as project
   documentation; the screens themselves are Spanish-only per criterion 8.
2. **Four proof states.** Each proof (identity, backing) renders one of:
   `generating`, `ready`, `failed`, `degraded`. `generating` is the screen
   the product is judged on — see criterion 12. `failed` and `degraded`
   are different answers and never collapse into one another:
   - `failed` — the predicate was evaluated and does not hold. Her collateral
     falls short, or the attestation does not match.
   - `degraded` — nobody could check. The proof server did not answer. Only
     `ready` advances the journey; `degraded` offers retry, never a way past
     an unanswered check, because telling her she does not qualify when
     nothing was evaluated is a lie. Four reasons the browser-direct path can
     tell apart before a proof is even attempted — `wallet_absent`,
     `wallet_locked`, `wallet_wrong_network`, `proof_server_unreachable` —
     get a heading and body of their own, naming the one thing to fix. All
     four are still degraded screens, still say nobody could check, and still
     offer only `Reintentar`.
3. **Split before/after screen.** The same three items — document, selfie,
   balance — appear on both sides. Left: legible, each crossing over to the
   counterparty (an arrow per row, the counterparty named at the bottom).
   Right: the same three struck through, plus a single chip carrying the
   outcome — nothing else crosses. Must read correctly with every label
   hidden: blur the text and the icon shapes, the strikethrough, and the one
   chip vs. many rows still tell the story to a judge who doesn't read
   Spanish, without translating anything.
4. **Offers screen.** Shows the proven tier and states plainly that no
   lending catalogue is connected — no rate, lender, or number is invented
   or shown.
5. **Synthetic labelling.** Every demo/stub value visible on screen (the
   demo-scenario selector, the identity outcome, the tier) carries a visible
   "SYNTHETIC" badge, not just an aria-label.
6. **Layout.** Zero horizontal overflow at 320 / 375 / 390px viewport width.
   No interactive control smaller than 44×44px. Exactly one `h1` per screen.
   Text and interactive colors meet WCAG AA contrast against their
   background. Both are measured, not assumed: axe-core's `color-contrast`
   rule and a `scrollWidth`/`clientWidth` check run over every screen state
   in both themes at all three widths, with the brand faces loaded and
   motion settled — measuring a fade-in mid-flight reports a contrast nobody
   ever sees. Control geometry is expressed in `em` rather than in fixed
   pixels, so a gutter or a bullet shrinks with its own text at 320px.
7. **Brand palette.** Colors and type come from
   `creva_finance/frontend/app/globals.css` — the palette's source of truth,
   light (cream) and dark (ink) — never invented. `generating` renders with
   `--cr-warning-*`, `verification failed` with `--cr-danger-*`, `ready` with
   `--cr-success-*`, `degraded` with `--cr-info-*`. Titles use `--font-playfair`
   (Montserrat), body/UI use `--font-inter` (Manrope), loaded from Google
   Fonts since this app has no next/font pipeline. The app icons carry
   `--cr-card-gradient` and no teal — Creva's palette has none. They are
   drawn from token values by `scripts/generate-icons.py`, never copied out
   of creva_finance: tokens are inherited by decision, image assets are not.
   `manifest.webmanifest` carries `#17130F` (`--cr-bg` on the ink palette).

   **Theme mechanism.** Light is the default, as it is in creva_finance. The
   ink palette is reachable two ways, and `test/theme-mechanism.spec.ts` keeps
   the two arms identical:

   | situation | what applies | result |
   |---|---|---|
   | standalone, OS light | `:root` | cream |
   | standalone, OS dark | `@media (prefers-color-scheme: dark)` | ink |
   | embedded, host sets `.dark` | `.dark` | ink |
   | embedded, host stays light on a dark OS | `.light` on the root | cream |

   That last row is the one an embedding host must opt into: without `.light`
   the media query would force ink on a host that is showing light.
8. **Language: Spanish only, decided.** Creva ships for Mexican
   entrepreneurs; this is a Creva feature, not a standalone demo. Every
   screen, label, button, and status message is in Spanish — no English, and
   the two are never mixed on one screen. `test/i18n.spec.ts` renders every
   screen in every reachable state and fails on a stray English word.
9. **The seam is the only source of outcomes.** The screens call
   `selectIdentityPort()` / `selectBackingPort()` and turn the result into a
   screen state with `toProofState`. Choosing a source is the whole switch:

   ```bash
   npm run dev --workspace web                          # stub, instant, default
   npm run serve --workspace api                        # then, in another shell:
   VITE_PORT_SOURCE=bridge npm run dev --workspace web  # a real ~23.7s proof
   ```

   With nothing set the journey selects the stub ports and touches no
   network; its copy and states are pinned by `test/defaultParity.spec.ts`.
   The stub answers instantly, so it is held for `MEASURED_PROOF_MS`
   (23 700 ms — the measured latency of one real proof, from
   `tools/measure-proof-latency.sh`), which is the same number the wait
   sequence is paced against. That hold applies to the stub *only*, so a
   real proof takes the time it takes and never has latency added to it.
   Kill the proof server and both screens land on `degraded`;
   `test/proofRun.spec.ts` proves that, and proves generating is entered
   before the call and left only after it settles.
10. **Named progress, and what is left.** Every screen says where she is
    (`Paso 2 de 4 · Tu respaldo`) and, on a second line, what is behind her
    and what remains (`1 listo · te faltan 3`) — the half a four-step form
    usually leaves her to count herself. The first step never opens on
    "0 listos"; it says how many there are and how many are left.
    `src/domain/journeyProgress.ts` owns it, plural agreement included.
11. **One earned celebration.** The tier reveal is the only moment the
    journey celebrates, and it lands on the tier, not on the proof: that a
    proof ran is not her achievement, knowing what she qualifies for is. The
    card arrives, a single ring expands out of it once, and the tier appears
    inside a beat later — an answer arriving, not a transition finishing.
    Nothing repeats, and nothing celebrates on the way there.
12. **The wait is the story.** A real proof takes ~23.7s. That wait is the
    only moment the product's promise is visible instead of asserted, so it
    is staged rather than hidden: a standing promise that nothing has left
    the device, a meter paced against the measured run, a seconds readout,
    and the **one** step of the work happening right now. Four steps stacked
    read as a to-do list she still had to get through; one line reads as work
    being done, so the meter and the seconds carry the sense of progress on
    their own — which is why they must stay honest (`MAX_PERCENT = 96`, no
    false "listo", the overtime line intact).

    When a step finishes it takes its check and holds it for
    `CELEBRATION_MS` before the next arrives. With one step on screen that
    beat is the only moment a completed step is ever seen, so it is never
    cut; it is derived from elapsed time alone, which keeps the whole
    sequence a pure function of the clock. A step is marked done only once
    its successor is already running, and the last step is never marked done
    at all — the answer has not arrived yet.

    The model lives in `src/domain/waitStages.ts` and is tested without
    waiting for it, including a walk of the whole run at the app's own tick
    rate. While a proof runs the region is patched field by field
    (`src/waitView.ts`) rather than re-rendered, so no transition is ever
    interrupted; a step swap inserts the arriving step into the flow and
    lifts the departing one out of it, so the slot never jumps. Under
    `prefers-reduced-motion` the swap happens without animating, still one
    step at a time, and the held beat survives because it is timing rather
    than motion.
13. **Plain language, and an answer when she wants one.** Primary copy is
    written for a Mexican entrepreneur applying for a card, most of whom have
    never touched crypto. No *predicado*, *atestación*, *circuito*,
    *testigo*, *witness* or *disclose* appears anywhere on a journey screen —
    not even folded away, because expanding a word mid-task still asks her to
    learn it in order to finish. The explanation lives in the help centre
    (criterion 15) and every screen carries a `?` that reaches it.
    `test/plainLanguage.spec.ts` scans every screen in every state.
14. **Motion with intent.** Animation marks state changes only — a screen
    arriving, the split's two halves separating, the tier landing, a wait step
    becoming live. Every transition and animation is timed with `--cr-ease`
    and a `--cr-dur*` token; the one exception is the wait meter's fill, which
    is `linear` because it reports elapsed time and easing it would report the
    wrong time. `prefers-reduced-motion: reduce` stands all of it down.
15. **The help centre.** Mirrors what `creva_finance/frontend` already ships,
    so it migrates by copying files rather than by rewriting them:

    | creva_finance | here |
    | --- | --- |
    | `lib/help-content.ts` | `src/help/helpContent.ts` |
    | `app/help/page.tsx` | `renderHelpIndex()` at `#/ayuda` |
    | `app/help/[category]` | `renderHelpCategory()` at `#/ayuda/:category` |
    | `app/help/[category]/[article]` | `renderHelpArticle()` at `#/ayuda/:category/:article` |
    | `components/help/HelpLink.tsx` | `renderHelpLink()`, 44px, same as the back link |
    | `test/lib/help-content.test.ts` | `test/help/helpContent.spec.ts` |

    `HelpArticle` is `{ slug, question, answer, steps?, note?, resolvedBy?,
    keywords? }` and `HelpCategory` is `{ slug, title, lead, icon, articles }`,
    as theirs are. `answer` is one line — what she reads before deciding to
    open anything. `keywords` is what she would type, not what we called it.
    The content module carries no markup at all, which the tests enforce; all
    of it lives in `helpRender.ts`.

    Three rules the tests hold:
    - **A `?` that leads nowhere fails the build**, as it does in
      creva_finance. Every screen's help path — including one per typed
      degraded reason, so "falta la cartera" reaches its own article — is
      resolved against the content module, and every link on every rendered
      page is checked too.
    - **No article ever states a threshold, a ratio, a formula or a tier
      boundary.** Same rule as theirs, same reason: that is Creva's business
      logic and publishing it would give it away. The test rejects
      comparators, percentages, currency and formula words, and rejects any
      sentence naming a tier and a figure together.
    - **It never dead-ends.** An unknown category falls back to the index and
      an unknown article to its category; every page carries a way back.

    Reading help does not interrupt a proof: the help centre renders over the
    journey's own root, so state and ticker survive the visit and a proof
    started before she left is still running when she returns.

## Proof-port sources

`VITE_PORT_SOURCE` picks which implementation backs the seam. Anything
unrecognised falls back to the stub.

| `VITE_PORT_SOURCE` | Who proves | Needs |
| --- | --- | --- |
| unset / `stub` | nobody — a synthetic outcome, held `MEASURED_PROOF_MS` (23.7s) so the staged wait is seen at its real pace | nothing |
| `real` | an in-process Node call path | Node, not a browser |
| `bridge` | `api/`'s local HTTP proof server | `npm run serve --workspace api` |
| `lace` | the browser itself, via Lace | the checklist below |

## The browser-direct path (`VITE_PORT_SOURCE=lace`)

This is the architecture the product ships: the page talks to Midnight
itself. Lace is the wallet, the indexer and node addresses come from Lace's
own settings, the private state lives in this browser's IndexedDB, and the
proof is generated by **the local proof server the user configured in Lace**
— nothing crosses a machine boundary, which is the entire privacy claim. No
Node process of ours sits in the middle: `api/`'s proof server is the
`bridge` source, and it is not involved here.

### What a reviewer must have installed

1. **A Chromium browser** — the extension below is not published for others.
2. **Lace, Midnight Preview build, publisher IOG.** Testnet only; there is no
   mainnet Midnight for it to talk to. Create or restore a wallet and unlock
   it before loading the page.
3. **A local Midnight proof server**, and Lace pointed at it: *Settings »
   Midnight » Local*, `http://localhost:6300`. The screens name this address
   verbatim, because a reviewer watching a stalled proof needs the number.
   The proof server must answer cross-origin requests from the dev server's
   origin (`http://localhost:5173` by default); one that is listening but
   refuses CORS will pass the reachability probe and then fail the proof.
4. **The compiled circuit's ZK artifacts, served over HTTP.** The browser has
   no filesystem, so `FetchZkConfigProvider` fetches them, in exactly the
   layout `compactc` writes and `NodeZkConfigProvider` reads:

   ```
   web/public/zk/keys/<circuitId>.prover
   web/public/zk/keys/<circuitId>.verifier
   web/public/zk/zkir/<circuitId>.bzkir
   ```

   No manual copy: `scripts/copy-zk-artifacts.mjs` mirrors them out of
   `contract/src/managed/` and runs from `npm run build` and `npm run dev`
   in this workspace, so `npm run verify` (which compiles first) and the web
   build both get them. See "The 2 MB the artifacts cost" below. Override the
   base URL with `VITE_ZK_CONFIG_URL` if they are served from somewhere else.
5. **Node 24.11.1+ and `npm ci`** at the repository root, as for any other
   source.

Then:

```
VITE_PORT_SOURCE=lace npm run dev --workspace web
```

### The 2 MB the artifacts cost

The artifacts are compiler output, regenerable by `npm run compact:build`, so
they are gitignored — `contract/src/managed/` and the served copy at
`web/public/zk/` both. The copy is the honest number for the Mobile track:

| File | Size |
| --- | --- |
| `keys/<id>.prover` — backing | 672 kB |
| `keys/<id>.prover` — identity | 1.3 MB |
| `keys/<id>.verifier` | ~1.6 kB each |
| `zkir/<id>.bzkir` | small |
| **total** | **~2 MB** |

That is ~2 MB on top of the 164 kB shell, and it is a real first-load weight
for an installable PWA. Two decisions follow from it, and both are held by
tests:

- **The service worker does not precache them.** `public/sw.js` bypasses the
  `/zk/` prefix before any cache branch, so the install payload stays the
  shell. Putting 2 MB into the install would hurt the very thing installing
  is meant to prove.
- **They are fetched when a proof is started**, on the `lace` source only.
  No other source requests them at all.

If the artifacts are missing, `npm run build --workspace web` fails and names
`npm run compact:build` rather than shipping a build that silently cannot
prove. `npm run dev` only warns, because the default source is the stub and
the journey does not need them to render.

### Budget the wait

A measured proof costs ~23.7s (`tools/PROOF-LATENCY.md`). `generating` is a
first-class screen state with a live elapsed-time readout for exactly that
reason, and on this source its copy names where the proof is being generated.

### The four ways this path degrades

Every external step returns a typed degraded result and never throws. All
four are `degraded`, never `failed`, per criterion 2: nothing was evaluated,
so none of them may read as a rejection. They are checked in this order, so
the screen names the first thing to fix.

| Reason | What the reviewer sees | What to do |
| --- | --- | --- |
| `wallet_absent` | "Falta la cartera" | Install Lace Midnight Preview |
| `wallet_locked` | "Cartera bloqueada" | Unlock it and authorise the site |
| `wallet_wrong_network` | "Red equivocada" | Switch Lace to Midnight preprod |
| `proof_server_unreachable` | "El servidor local no responde" | Start the proof server on `:6300` |

Every other reason — `call_failed` included — keeps the shipped "No pudimos
verificarlo" copy.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_LACE_NETWORK_ID` | `testnet` | The network id the wallet must report; anything else is `wallet_wrong_network`. Set this if your Lace build reports a different string for preprod. |
| `VITE_ZK_CONFIG_URL` | `/zk` | Base URL the circuit artifacts are served from. |

### Build note

Midnight's ledger ships as WebAssembly, so on this source `vite.config.ts`
loads `vite-plugin-wasm` and targets `es2022` (native top-level await). The
lace port is behind a dynamic import (`src/lacePort.ts`) and lands in its own
chunk, fetched only when a proof is started.

Rollup walks a dynamic import's module graph *before* it eliminates the dead
branch around it, so a guard alone is not enough: on every other source the
config also aliases `@creva-zk/api/lace` to `src/laceUnavailable.ts` and
leaves the WASM plugin out. Without that alias a stub build emits 11 MB of
WebAssembly nothing references. With it:

| Build | `dist/` |
| --- | --- |
| default | 164 kB — 13.9 kB of JS, no WASM, no lace chunk |
| `VITE_PORT_SOURCE=lace` | ~12 MB — 15.3 kB entry, a 590 kB lace chunk, 11.5 MB of WASM |

The size on the lace source is inherent to proving in the page.

## Out of scope

The default (`stub`) journey makes no real contract calls, uses no wallet,
and makes no network calls beyond the existing service worker's shell
caching. `npm run verify` cannot pass in this environment (no compact
toolchain, no Docker) — see the session report for what that leaves
unverified.

The browser-direct path has never been run end to end: there is no browser,
no Lace and no proof server in the environment it was written in. It is
typechecked, bundled for the browser (verified to contain zero `node:`
imports), and unit-tested against a fake dapp connector and a fake fetch.
The deploy and call step on top of its provider stack is the same unfinished
wiring the `real` source has, and degrades honestly rather than inventing a
result.
