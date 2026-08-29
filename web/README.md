<!--
  README.md
  Acceptance criteria for the web/ screen journey, written before the
  screens were built. Update this file if a criterion changes.
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

## Out of scope

No real contract calls, no wallet, no network calls beyond the existing
service worker's shell caching. `npm run verify` cannot pass in this
environment (no compact toolchain, no Docker) — see the session report for
what that leaves unverified.
