<!--
  README.md
  Acceptance criteria for the web/ screen journey, written before the
  screens were built and revised when the journey was rewritten for plain
  language, plus the exact checklist a reviewer must satisfy to exercise the
  browser-direct (Lace) proof path, which now joins a deployed contract and
  runs a real proof. Update this file if a criterion changes.
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
     nothing was evaluated is a lie. Five reasons the browser-direct path can
     tell apart before a proof is even attempted — `wallet_absent`,
     `wallet_locked`, `wallet_wrong_network`, `proof_server_unreachable`,
     `contract_not_found` — get a heading and body of their own, naming the
     one thing to fix. All five are still degraded screens, still say nobody
     could check, and still offer only `Reintentar`. The fifth is the only
     one she cannot act on herself, and its copy says so: it asks her to tell
     whoever installed the app, not to install or start anything.
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
6. **Layout.** One focal point per screen: hierarchy and spacing carry the
   state, not a stack of bordered cards. The only surfaces that still draw a
   box are the two halves of the split, whose whole point is two things side
   by side. Zero horizontal overflow at 320 / 375 / 390px viewport width.
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
   VITE_PORT_SOURCE=bridge npm run dev --workspace web  # a real proof (~23.7s, backing)
   ```

   With nothing set the journey selects the stub ports and touches no network; its copy and
   states are pinned by `test/defaultParity.spec.ts`.

   The stub answers instantly, so it is held for `MEASURED_PROOF_MS` (23 700 ms — the measured
   latency of one real **backing** proof, from `tools/measure-proof-latency.sh`; no identity
   proof has been timed), which is the same number the wait sequence is paced against.

   That hold applies to the stub *only*, so a real proof takes the time it takes and never has
   latency added to it. Kill the proof server and both screens land on `degraded`;
   `test/proofRun.spec.ts` proves that, and proves generating is entered before the call and left
   only after it settles.
10. **Progress, said once.** One compact treatment at the foot of the screen
    — `1 de 4` beside a track of one segment per step, the current one wider
    as well as darker so position never rests on colour alone. It used to be
    said twice, in two competing lines above the title (`Paso 2 de 4 · Tu
    respaldo` over `1 listo · te faltan 3`); the track now shows what is
    behind her, and the sentence a screen reader hears
    (`Paso 2 de 4: Tu respaldo`) is the group's accessible name.
    `src/domain/journeyProgress.ts` owns it, and
    `plainLanguage.spec.ts` fails if any screen states progress a second
    time.
11. **One earned celebration.** The tier reveal is the only moment the
    journey celebrates, and it lands on the tier, not on the proof: that a
    proof ran is not her achievement, knowing what she qualifies for is. The
    card arrives, a single ring expands out of it once, and the tier appears
    inside a beat later — an answer arriving, not a transition finishing.
    Nothing repeats, and nothing celebrates on the way there.
12. **The wait is the story.** A real backing proof takes ~23.7s — the only
    proof latency this repository has measured; the identity proof verifies a
    signature in-circuit and is therefore slower by an unmeasured amount. That wait is the
    only moment the product's promise is visible instead of asserted, so the
    verification itself is the screen's hero rather than a card on it: one
    ring carrying the elapsed seconds, paced against the measured run, and
    under it the **one** named step of the work happening right now. Four
    steps stacked read as a to-do list she still had to get through; one line
    reads as work being done, and what is still ahead is the ring's job.
    There is no button while the work is on: a disabled "Trabajando en tu
    teléfono…" only repeated the ring.

    When a step finishes it takes its check and holds it for `CELEBRATION_MS` before the next
    arrives.

    With one step on screen that beat is the only moment a completed step is ever seen, so it is
    never cut; it is derived from elapsed time alone, which keeps the whole sequence a pure
    function of the clock. A step is marked done only once its successor is already running, and
    the last step is never marked done at all — the answer has not arrived yet.

    The model lives in `src/domain/waitStages.ts` and is tested without
    waiting for it, including a walk of the whole run at the app's own tick
    rate.

    Two things the readout will not do. It reports elapsed time only — `Llevamos 21 s`, never `21
    s de unos 24 s`, because the estimate is precision the app cannot promise on a source whose
    latency it does not control.

    And past the measured run the ring stops short of closing (`MAX_PERCENT = 96`, so nothing on
    screen claims completion until the answer lands) while the headline takes over (`Estamos
    terminando` / "No necesitas hacer nada"): a slower proof has not failed, and claiming it
    finished would be a lie.

    While a proof runs the region is patched field by field (`src/waitView.ts`) rather than
    re-rendered, so no transition is ever interrupted: the headline swap, the ring, the readout
    and the step's status all arrive in place, and a step swap inserts the arriving step into the
    flow and lifts the departing one out of it, so the slot never jumps.

    Under `prefers-reduced-motion` the swap happens without animating, still one step at a time,
    and the held beat survives because it is timing rather than motion.
13. **Plain language, and an answer when she wants one.** Primary copy is
    written for a Mexican entrepreneur applying for a card, most of whom have
    never touched crypto. No *predicado*, *atestación*, *circuito*,
    *testigo*, *witness* or *disclose* appears anywhere on a journey screen —
    not even folded away, because expanding a word mid-task still asks her to
    learn it in order to finish. The explanation lives in the help centre
    (criterion 15) and every screen carries a `?` that reaches it.
    `test/plainLanguage.spec.ts` scans every screen in every state.
14. **Motion with intent.** Animation marks state changes only — a screen
    arriving, the split's two halves separating, the tier landing, one wait
    step leaving as the next one arrives. Every transition and animation is timed with
    `--cr-ease` and a `--cr-dur*` token; the one exception is the verification
    ring's advance, which is `linear` because it reports elapsed time and
    easing it would report the wrong time. `prefers-reduced-motion: reduce`
    stands all of it down.

15. **The help centre.** Mirrors what `creva_finance/frontend` already ships,
    so it migrates by copying files rather than by rewriting them:

    | creva_finance | here |
    | --- | --- |
    | `lib/help-content.ts` | `src/help/helpContent.ts` |
    | `app/help/page.tsx` | `renderHelpIndex()` at `#/ayuda` |
    | `app/help/[category]` | `renderHelpCategory()` at `#/ayuda/:category` |
    | `app/help/[category]/[article]` | `renderHelpArticle()` at `#/ayuda/:category/:article` |
    | `components/help/HelpLink.tsx` | `renderHelpButton()` in `src/ui/notices.ts`, 44px |
    | `test/lib/help-content.test.ts` | `test/help/helpContent.spec.ts` |

    `HelpArticle` is `{ slug, question, answer, steps?, note?, resolvedBy?, keywords? }` and
    `HelpCategory` is `{ slug, title, lead, icon, articles }`, as theirs are.

    `answer` is one line — what she reads before deciding to open anything. `keywords` is what
    she would type, not what we called it. The content module carries no markup at all, which the
    tests enforce; all of it lives in `helpRender.ts`.

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

16. **A system, not six screens.** Each state of the flow is rendered in an
    archetype of its own — `intro`, `verifying`, `confirm`, `recover`,
    `compare`, `celebrate` — so no two steps read as the same card template
    with different words in it. The archetype decides the spacing, the focal
    element and where the action sits; the screens themselves write no markup.
    Everything they are built from lives in `src/ui/`:

    | component | what it is |
    | --- | --- |
    | `renderOnboardingShell` | the frame: navigation strip, body, step indicator |
    | `renderStepIndicator` | `1 de 4` and its track, at the foot of the screen |
    | `renderScreenHeader` | the mark, the headline and one short lede |
    | `renderStatusState` | four tones, for a state that has an answer to give |
    | `renderVerificationState` | the ring, the readout and the one step running now |
    | `renderSecurityNotice` | the promise, as a line rather than a card |
    | `renderHelpButton` / `renderHelpWhy` | the persistent `?`, and the second action `recover` gets |
    | `renderPrimaryAction` | the one action per screen, and never two |
    | `renderSystemStatus` | the install state, as a lock beside the `?` |

    The tones map onto the proof phases and onto Creva's semantic families exactly as they always
    did — `processing` → `--cr-warning-*`, `success` → `--cr-success-*`, `warning` →
    `--cr-danger-*` (the check ran and the answer is no), `error` → `--cr-info-*` (nobody could
    check) — which `style-controls.spec.ts` pins.

    `render.spec.ts` pins that the four proof states resolve to four different archetypes.

17. **Micro-moments inside the wait.** While a proof runs, a popover emerges
    from the navigation strip — the same gesture as `icon-button-tip` — which
    says one thing and leaves on its own. It is not a card and not a modal, it
    asks for no interaction, and it has no close button.

    **The moment belongs to the wait, not to the step.** It is armed when the state turns
    `generating` and disarmed when the answer arrives. No moment is triggered by a tap, and none
    lengthens the journey: a cue the answer managed to overtake is discarded rather than shown
    late. `test/momentView.spec.ts` pins this in both directions.

    **Four beats, two waits.** The journey only makes her wait twice — the
    identity proof and the backing proof, about 23.7 s each — so the four-beat
    arc is distributed across those two. Moments 1 and 2 in the identity wait,
    3 in the backing wait, and 4 as the answer lands: saying "done" with the
    bar at 81 % would be the one lie this screen has never told.

    **The drawing comes first.** Each moment opens with a line icon on a circular chip — the
    vocabulary of Creva's settings rows: 1.75 stroke, round caps, `--cr-danger-text` on
    `--cr-surface-2` — and the text is its caption. The four icons are distinct: a door, a
    bicycle, layers assembling, a celebration.

    **It never overlaps the action.** It anchors at the top, because the strip
    is the one part of the frame she is not trying to touch. Verified with
    `elementFromPoint` and with rectangle intersection against the CTA, the
    ring and the visible step, at 320/390/768 and in both themes.

    **Timing.** It enters over `--cr-dur` (240 ms), stays 3 s, leaves over
    240 ms. Under `prefers-reduced-motion` it appears and disappears without
    travelling, with the same time on screen: that is a timer, not motion.

    **What is missing counts as progress.** The structural moment shows where she is in the
    journey — what is done alongside what remains — read from real state, not from an invented
    list of paperwork.

    At most two pending items are visible; the rest are counted ("+ 2 more items"). That is why
    the comparison screen stopped being headed "Here is what you did not hand over".

    **One single figure in the whole journey**, and `test/content/waitingMoments.spec.ts` fails
    if a second one appears. Only what is verified in a primary source is published: ENAFIN 2024
    (INEGI, press release 62/25, 28 May 2025), with URL and access date in the module.

    It uses the press release's verb, "ha tenido financiamiento" (*has had financing*), not the
    chart's "solicitado" (*applied for*): having applied and having had are not the same measure.
    Another test fails if any of the figures that could not be verified appears.

## Proof-port sources

`VITE_PORT_SOURCE` picks which implementation backs the seam. Anything
unrecognised falls back to the stub.

| `VITE_PORT_SOURCE` | Who proves | Needs |
| --- | --- | --- |
| unset / `stub` | nobody — a synthetic outcome, held `MEASURED_PROOF_MS` (23.7s, the measured latency of one **backing** proof) so the staged wait is seen at its real pace | nothing |
| `real` | the in-process Node call path — it deploys and runs both circuits | Node, not a browser; degrades in one |
| `bridge` | `api/`'s local HTTP proof server, backed by the real port | `npm run serve --workspace api`, Docker, the Compact toolchain |
| `lace` | the browser itself, via Lace | the checklist below |

On `bridge` and on `lace` the backing screen shows a real proof — `proveBacking`, ~23.7s —
instead of a degraded result. Both report `bronze` when the collateral clears, because that is
the strongest tier a boolean circuit proves; see [`api/README.md`](../api/README.md).

**`proveIdentity` is wired now** — `identity-check.compact` has a TypeScript binding
(`contract/src/identity.ts`), and `api/`'s `real` port deploys it and runs the circuit. Two
things about that proof are stated plainly rather than dressed up:

- **The issuer is synthetic.** Creva's KYC provider signs nothing today, so the attestation is
  signed by a key the deployment generates for itself. The *verification* is real — Schnorr over
  Jubjub, checked inside the circuit on every proof — but the thing being verified belongs to
  nobody.
- **An attestation from another issuer aborts the proof** and comes back `degraded`, not `false`.
  Per criterion 2 that is correct: nothing was evaluated, so nothing may read as a rejection.

**The identity screen nonetheless still degrades on every real source**, and for two different
reasons — neither of them "nobody got to it":

- On **`bridge`**, the browser sends the fixed `SYNTHETIC_ISSUER_KEY` from
  `src/domain/demoInputs.ts`, while the server's deployment issues a **fresh issuer key per
  process** and nothing on `/proof/identity` hands that key back. A key that is not the issuer's
  is exactly the abort case above, so the screen lands on `degraded`.
- On **`lace`**, the browser-direct path has no second contract to join: it joins the backing
  contract at an address the build supplies, and no identity deployment address is supplied.

So on those sources the CTA does not advance out of step 1 and the backing screen is not
reachable by clicking through — call `selectBackingPort().checkBacking(...)` from the console, or
run the journey on `stub` for the flow and on `lace` for the proof. Wiring past that gate would
mean fabricating an identity outcome, which this repository will not do.

## The browser-direct path (`VITE_PORT_SOURCE=lace`)

This is the architecture the product ships: the page talks to Midnight itself. Lace is the
wallet, the indexer and node addresses come from Lace's own settings, the private state lives in
this browser's IndexedDB, and the proof is generated by **the local proof server the user
configured in Lace** — nothing crosses a machine boundary, which is the entire privacy claim.

No Node process of ours sits in the middle: `api/`'s proof server is the `bridge` source, and it
is not involved here.

### What a reviewer must have installed

Every one of these is a precondition with a screen of its own: miss one and
the page says which, in her words, and offers only `Reintentar`.

1. **A Chromium browser** — the extension below is not published for others.
2. **Lace, Midnight Preview build, publisher IOG.** Testnet only; there is no
   mainnet Midnight for it to talk to. Create or restore a wallet and unlock
   it before loading the page. → `wallet_absent` / `wallet_locked`.
3. **Lace on the network this build expects**, `preprod` by default. → 
   `wallet_wrong_network`. The identifier a given Lace build reports is the
   one thing this repository cannot settle from its own dependencies: read
   the console (`lace reported its connection status`), and if it is not
   `preprod`, set `VITE_LACE_NETWORK_ID` to whatever it printed. See "Which
   network id" below.
4. **tDUST in that wallet.** Every call transaction pays a fee, and Lace
   balances it: an empty wallet fails inside `balanceUnsealedTransaction` and
   reaches the screen as `call_failed`, ~24s in, not as a precondition.
   Fund it from the network's faucet before the demo, not during it.
5. **A local Midnight proof server**, and Lace pointed at it: *Settings »
   Midnight » Local*, `http://localhost:6300`. The screens name this address
   verbatim, because a reviewer watching a stalled proof needs the number.
   → `proof_server_unreachable`.

   ```bash
   docker compose -f ../api/proof-server-local.yml up
   ```

   **It must answer cross-origin requests from the page's origin** (`http://localhost:5173` by
   default). The probe is a real cross-origin `GET` carrying `Content-Type:
   application/octet-stream` — not a safelisted value, so the browser preflights exactly as it
   will for the prover's own `POST /check` and `POST /prove`.

   A server that rejects CORS therefore fails the probe rather than passing it and dying ~20s
   later inside the prover. The rejection itself is a bare `TypeError` to a page,
   indistinguishable from a dead port, so the error is logged to the console — `local proof
   server probe failed` — and the screen says the honest, coarser thing.
6. **The backing contract, deployed once, and its address in the build.**
   The browser JOINS it; it never deploys. → `contract_not_found`. See
   "Deploy it once" below.
4. **The compiled circuit's ZK artifacts, served over HTTP.** The browser has
   no filesystem, so `FetchZkConfigProvider` fetches them, in exactly the
   layout `compactc` writes and `NodeZkConfigProvider` reads:

   ```
   web/public/zk/keys/<circuitId>.prover
   web/public/zk/keys/<circuitId>.verifier
   web/public/zk/zkir/<circuitId>.bzkir
   ```

   No manual copy: `scripts/copy-zk-artifacts.mjs` mirrors them out of `contract/src/managed/`
   and runs from `npm run build` and `npm run dev` in this workspace, so `npm run verify` (which
   compiles first) and the web build both get them. See "The 2 MB the artifacts cost" below.
   Override the base URL with `VITE_ZK_CONFIG_URL` if they are served from somewhere else.
8. **Node 24.11.1+ and `npm ci`** at the repository root, as for any other
   source.

Then:

```bash
npm run compact:build                     # the circuit and its artifacts
npm run zk:copy --workspace web           # serve them from web/public/zk/
VITE_PORT_SOURCE=lace \
VITE_BACKING_CONTRACT_ADDRESS=<64 hex chars> \
  npm run dev --workspace web
```

### Deploy it once

The browser joins a contract; it does not deploy one. Deploying in the page would cost her the
~19s the Node path pays **and** ask her to sign a deployment that is not hers — so the wait would
be ~43s instead of ~24s for work she did not ask for and does not own. The deployment is a
one-off, done from the CLI by whoever sets the demo up:

```bash
npm run demo --workspace api   # deploys, then proves twice; prints the address
```

Hand that address to the build as `VITE_BACKING_CONTRACT_ADDRESS` (64 hex
characters, no `0x` — see `assertIsContractAddress` in
`@midnight-ntwrk/midnight-js-utils`). Without it the port degrades
`contract_not_found` and joins nothing; it never falls back to deploying.

Her wallet then signs exactly one thing: her own proof.

### Which network id

`VITE_LACE_NETWORK_ID` defaults to `preprod`, and that is read off the installed packages rather
than guessed.

The well-known set is declared in `@midnight-ntwrk/wallet-sdk-abstractions/dist/NetworkId.js` —
`mainnet`, `testnet`, `devnet`, `qanet`, `undeployed`, `preview`, `preprod` — and
`@midnight-ntwrk/testkit-js`'s `PreprodTestEnvironment` reports exactly `preprod`. `testnet` is a
different member of that set, not a synonym, which is why this default changed.

What no installed package can say is which member **Lace Midnight Preview** reports; it may well
report `preview`. So the value the wallet actually sends is logged on every connection, from both
`getConnectionStatus()` and `getConfiguration()`, and the override is an environment variable
rather than a code edit.

### The 2 MB the artifacts cost

The artifacts are compiler output, regenerable by `npm run compact:build`, so
they are gitignored — `contract/src/managed/` and the served copy at
`web/public/zk/` both. The copy is the honest number for the Mobile track:

| File | Size |
| --- | --- |
| `keys/proveBacking.prover` | 149 kB |
| `keys/proveBackingTier.prover` | 688 kB |
| `keys/proveIdentity.prover` | 1.35 MB |
| `keys/<id>.verifier` | 1.4–1.6 kB each |
| `zkir/<id>.bzkir` | 126–267 B each |
| **total** | **2.2 MB** |

Measured with `du` on `web/public/zk/` after `npm run compact:build`, 2026-08-29.
The two larger keys are the two circuits that verify a signature in-circuit;
`proveBacking` does not, which is the whole difference.

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

A measured **backing** proof costs ~23.7s (`tools/PROOF-LATENCY.md`, measured on
`backing.compact`, which does no in-circuit signature verification).

The identity proof does verify a signature in-circuit, so it costs more — how much more is not
measured, and no number for it is stated. `generating` is a first-class screen state with a live
elapsed-time readout for exactly that reason, and on this source its copy names where the proof
is being generated.

### The five ways this path degrades

Every external step returns a typed degraded result and never throws. All
five are `degraded`, never `failed`, per criterion 2: nothing was evaluated,
so none of them may read as a rejection. They are checked in this order, so
the screen names the first thing to fix.

| Reason | What the reviewer sees | What to do |
| --- | --- | --- |
| `wallet_absent` | "Falta la cartera" | Install Lace Midnight Preview |
| `wallet_locked` | "Cartera bloqueada" | Unlock it and authorise the site |
| `wallet_wrong_network` | "Red equivocada" | Switch Lace to Midnight preprod |
| `proof_server_unreachable` | "El servidor local no responde" | Start the proof server on `:6300` |
| `contract_not_found` | "Falta un dato de esta app" | Set `VITE_BACKING_CONTRACT_ADDRESS`; for the identity port, `VITE_IDENTITY_CONTRACT_ADDRESS` **and** `VITE_IDENTITY_ISSUER_KEY` |

Every other reason — `call_failed` included — keeps the shipped "Nadie pudo
revisarlo" copy. `call_failed` is where a real failure *after* the
preconditions lands: no tDUST to balance the fee, a proof server that dies
mid-proof, an indexer that loses the connection.

The raw cause behind every one of them goes to the browser console (the seam
in `src/proofPort.ts` supplies the only logger this app installs) and never
into the reason itself, which is a fixed string precisely so it cannot carry
an endpoint or a stack fragment onto the screen.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_LACE_NETWORK_ID` | `testnet` | The network id the wallet must report; anything else is `wallet_wrong_network`. Set this if your Lace build reports a different string for preprod. |
| `VITE_ZK_CONFIG_URL` | `/zk` | Base URL the circuit artifacts are served from. |
| `VITE_BASE` | `/` | Path the site is served under. GitHub Pages serves a project site at `/<repo>/`, so a deploy needs `VITE_BASE=/creva-zk/` — that is what `npm run build:pages` sets. Read by `vite.config.ts` from `process.env`, so a `.env` file cannot carry it. |
| `VITE_IDENTITY_CONTRACT_ADDRESS` | unset | Address of the identity contract the port JOINS. Unset, the identity port degrades `contract_not_found`. |
| `VITE_IDENTITY_ISSUER_KEY` | unset | The key `proveIdentity` verifies the attestation's signature against, as `"x:y"` with **both coordinates in decimal** — never a compressed point. Unset or malformed, the identity port degrades `contract_not_found`. |

Both identity variables come off the operator deployment screen together; see
[`docs/LACE-DEPLOY.md`](../docs/LACE-DEPLOY.md).

With the address but no key the circuit aborts on the signature check, which reads on screen as
"not yet" about an identity that was in fact valid — so the port refuses to join rather than pay
for a proof that cannot clear.

### Build note

Midnight's ledger ships as WebAssembly, so on this source `vite.config.ts`
loads `vite-plugin-wasm` and targets `es2022` (native top-level await). The
lace port is behind a dynamic import (`src/lacePort.ts`) and lands in its own
chunk, fetched only when a proof is started.

Rollup walks a dynamic import's module graph *before* it eliminates the dead branch around it, so
a guard alone is not enough: on every other source the config also aliases `@creva-zk/api/lace`
to `src/laceUnavailable.ts` and leaves the WASM plugin out. Without that alias a stub build emits
11 MB of WebAssembly nothing references. With it:

| Build | `dist/` |
| --- | --- |
| default | 215 kB — 32.5 kB of JS (11.1 kB gzipped), one chunk, no WASM, no lace chunk |
| `VITE_PORT_SOURCE=lace` | megabytes — a lace chunk plus the ledger's WASM |

Measured with `npx vite build` in this workspace. The default build emits a single JS chunk and
31 modules; `grep` for `laceProofPort`, `dapp-connector` or `browser-level` in it returns
nothing. Joining the contract added 1.1 kB raw / 0.3 kB gzipped to it — the fifth degraded
reason's copy, its help article, and the console logger — and no chunk.

The size on the lace source is inherent to proving in the page, and it is now the *only* build
that carries the compiled circuit:

`contract.ts` reaches `contract/src/managed/`, so **`VITE_PORT_SOURCE=lace` builds require `npm
run compact:build` first**, as does typechecking this workspace. The default build does not — the
alias above keeps that module out of its graph entirely.

## Out of scope

The default (`stub`) journey makes no real contract calls, uses no wallet, and makes no network
calls beyond the existing service worker's shell caching. `npm run verify` cannot pass in this
environment (no compact toolchain, no Docker) — see the session report for what that leaves
unverified.

The browser-direct path has never been run end to end: there is no browser, no Lace, no proof
server and no Compact toolchain in the environment it was written in. It is unit-tested against a
fake dapp connector, a fake fetch and fake join/call seams, and the default build is measured.
What a human still has to confirm, with Lace in front of them:

- The network id Lace Midnight Preview reports. The default is `preprod`,
  read off the installed packages; if the console prints `preview`, set
  `VITE_LACE_NETWORK_ID=preview`.
- That the join actually finds the CLI's deployment, and that the verifier
  keys served from `/zk/` match the ones on chain — a mismatch is
  `contract_not_found` too, by design, and the console says which.
- That `balanceUnsealedTransaction` and `submitTransaction` accept the
  hex the wallet provider sends. Hex is not assumed here: the reference
  `DAppConnectorWalletAdapter` in
  `@midnight-ntwrk/testkit-js/dist/index.mjs` — which `implements
  ConnectedAPI` — decodes both with `fromHex` and returns
  `{ tx: toHex(finalized.serialize()) }`. The connector's own `api.d.ts`
  and README only say `tx: string`.
- That the proof server's CORS configuration passes the preflight the probe
  now sends, and that the whole call lands near ~24s rather than ~43s.
