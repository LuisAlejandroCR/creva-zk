<!--
  README.md
  Acceptance criteria for the web/ screen journey, written before the
  screens were built. Update this file if a criterion changes.
-->

# Creva ZK — web screen journey

## Scope

This app drives every proof outcome from a local, typed stub (`src/domain`).
It does not call `api/`, `contract/`, `anchoring/`, or `advisor/` — those are
owned by other agents. The stub exposes exactly a `Tier` and a verified
boolean, and every screen state is derived from it, including the failure
states.

## Acceptance criteria

1. **Journey.** "Apply for the card" (identity) → "see what you qualify for"
   (backing) → a before/after comparison → an offers screen. The identity
   and backing screens each expose one primary action, whose label changes
   with proof phase (Start → Retry / Continue / Continue anyway).
2. **Four proof states.** Each proof (identity, backing) renders one of:
   `generating`, `ready`, `verification failed`, `degraded`. `generating` is
   its own screen state with an elapsed-time readout, not a spinner — real
   proofs here take tens of seconds, and the UI says so.
3. **Split before/after screen.** Left: what a normal card application hands
   over (ID scan, pay stubs, full balance, address, phone — many rows, an
   "exposed" visual language). Right: what this flow hands over (a verified
   check, a proven tier — two rows, a "sealed" visual language). The
   asymmetry in row count, iconography, and color must read correctly with
   the text hidden.
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
   Fonts since this app has no next/font pipeline.

## Out of scope

No real contract calls, no wallet, no network calls beyond the existing
service worker's shell caching. `npm run verify` cannot pass in this
environment (no compact toolchain, no Docker) — see the session report for
what that leaves unverified.
