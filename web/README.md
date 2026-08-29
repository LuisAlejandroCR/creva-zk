<!--
  README.md
  Acceptance criteria for the web/ screen journey, written before the
  screens were built, plus what a reviewer must have installed to exercise
  the browser-direct (Lace) proof path. Update this file if a criterion
  changes.
-->

# Creva ZK — web screen journey

## Scope

Every proof outcome on screen comes from a `@creva-zk/api` port, chosen by
the seam in `src/proofPort.ts`. There is one stub and it lives behind that
port; `src/domain/demoInputs.ts` holds only the synthetic *inputs* a call is
made with. No screen decides an outcome for itself.

## Acceptance criteria

1. **Journey.** "Solicita la tarjeta" (identity) → "Descubre a qué calificas"
   (backing) → a before/after comparison → an offers screen. The identity
   and backing screens each expose one primary action, whose label changes
   with proof phase (Iniciar → Reintentar / Continuar). This README stays in
   English as project documentation; the screens themselves are Spanish-only
   per criterion 8.
2. **Four proof states.** Each proof (identity, backing) renders one of:
   `generating`, `ready`, `failed`, `degraded`. `generating` is its own
   screen state with an elapsed-time readout, not a spinner — real proofs
   here take tens of seconds, and the UI says so. `failed` and `degraded`
   are different answers and never collapse into one another:
   - `failed` — the predicate was evaluated and does not hold. Her collateral
     falls short, or the attestation does not match.
   - `degraded` — nobody could check. The proof server did not answer. Only
     `ready` advances the journey; `degraded` offers retry, never a way past
     an unanswered check, because telling her she does not qualify when
     nothing was evaluated is a lie.
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
   background.
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

   With nothing set the journey behaves exactly as it did before it was
   wired — same copy, same states, same 32s hold on the generating screen —
   pinned by `test/defaultParity.spec.ts`. That hold applies to the stub
   *only*, so a real proof takes the time it takes and never has latency
   added to it. Kill the proof server and both screens land on `degraded`;
   `test/proofRun.spec.ts` proves that, and proves generating is entered
   before the call and left only after it settles.

## Proof-port sources

`VITE_PORT_SOURCE` picks which implementation backs the seam. Anything
unrecognised falls back to the stub.

| `VITE_PORT_SOURCE` | Who proves | Needs |
| --- | --- | --- |
| unset / `stub` | nobody — a synthetic outcome, held 32s so the generating screen is seen | nothing |
| `real` | the in-process Node call path — it deploys and runs the circuit | Node, not a browser; degrades in one |
| `bridge` | `api/`'s local HTTP proof server, backed by the real port | `npm run serve --workspace api`, Docker, the Compact toolchain |
| `lace` | the browser itself, via Lace | the checklist below |

On `bridge` the backing screen now shows a real proof — `proveBacking` against the local network,
~23.7s — instead of a degraded result. It reports `bronze` when the collateral clears, because
that is the strongest tier a boolean circuit proves; see [`api/README.md`](../api/README.md).
The identity screen still degrades on that source: `proveIdentity` has no TypeScript binding and
no JubJub signer, and the reason is spelled out there.

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

   Copy them out of `contract/src/managed/backing` after `npm run
   compact:build`. Override the base URL with `VITE_ZK_CONFIG_URL` if they
   are served from somewhere else.
5. **Node 24.11.1+ and `npm ci`** at the repository root, as for any other
   source.

Then:

```
VITE_PORT_SOURCE=lace npm run dev --workspace web
```

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
