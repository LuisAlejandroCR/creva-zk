devpost-submission.md
Field-by-field copy-paste target for the Devpost form: elevator pitch, the full
"About the project" story, the Built-with tags, the image-gallery shot list, and
the two Midnight sponsor questions. English throughout, because the form is.
Every figure here is measured in this repository and names where it came from;
nothing is estimated. Companion to devpost.md, which holds the shorter blurb.

# Devpost submission — Creva ZK

Deadline that governs: **Sunday 10:00 EDT** (initial submission). Everything below is ready
to paste; nothing needs editing except where a ⚠️ says so.

---

## 1 · Elevator pitch

> An entrepreneur applies for a collateralized card and sees what she qualifies for — without
> handing anyone her ID or her balance. Two zero-knowledge proofs on Midnight.

*(163 characters, inside Devpost's 200-character limit.)*

Alternates, if you want a different angle:

- *Prove you qualify without showing why. Two ZK circuits on Midnight turn an ID document and a
  bank balance into one tier and one boolean.* (140)
- *The card application that learns the answer and nothing else: collateral and identity are
  checked inside a Compact circuit and never leave the device.* (150)

---

## 2 · About the project

Paste everything between the rules, as-is. It is already Markdown.

---

## The problem

Getting a collateralized card works the same way everywhere: you hand over your ID document and
your account balance to a person, or to a backend, that can see both — in full, permanently — in
order to answer a question that is a single yes or no. The applicant carries all the exposure and
the counterparty gets far more than the answer it needed.

We build Creva, a financial platform for women entrepreneurs in Mexico, so this is not a
hypothetical for us. The question a card application actually asks is small: *does this collateral
clear this limit*, and *is this person verified, of age, and the tax ID she claims*. Everything
handed over beyond those two answers is collateral damage.

## What it does

Creva ZK answers both questions with a zero-knowledge proof generated on the applicant's own
device. One primitive, implemented twice: **verify a signed attestation inside a Compact circuit,
evaluate a public predicate, and disclose exactly one derived value.**

| Proof | Moment | Predicate | What ever reaches the chain |
|---|---|---|---|
| **Backing** | seeing what she qualifies for | collateral ≥ requested limit → tier | the tier (NONE / BRONZE / SILVER / GOLD) |
| **Identity** | applying for the card | verified ∧ of age ∧ tax ID matches | a single boolean |

The collateral amount and the identity claim are witnesses. They are never written to the ledger,
never sent to a server, and never disclosed — and that is not a comment in the source, it is an
automated invariant test (`witness-never-reaches-the-ledger.invariant.spec.ts`) that fails the
build if it stops being true.

What gets anchored to an external chain is a **blinded commitment to the outcome**, not the
outcome: a sha256 over `{tier, timestamp}` plus a 32-byte blinding factor that never leaves the
holder, so the anchor alone carries no usable entropy to brute-force, and the holder can open it to
an auditor later. The identity outcome is never anchored at all — a public record saying *"this key
was verified"* is exactly the linkable trace the product promises not to leave.

### Before / after, in one screen

The app ships a split screen built to read with the sound off and without knowing Spanish. Left:
document, selfie and balance, each legible, each with an arrow crossing to the counterparty. Right:
the same three struck through, and one chip crossing over carrying the outcome. Blur every label
and the story still reads: many arrows versus one chip.

### Three states, and the difference between two of them

Every proof renders as `generating`, `ready`, `failed`, or `degraded` — and `failed` and `degraded`
never collapse into each other:

- **`failed`** — the predicate was evaluated and does not hold. Her collateral falls short.
- **`degraded`** — *nobody could check*. The proof server did not answer, the wallet is on the wrong
  network, the attestation was signed by an issuer this deployment does not know.

Only `ready` advances the journey. `degraded` offers a retry and never a way past an unanswered
check, because telling a woman she does not qualify when nothing was evaluated is a lie. Every
external dependency in the codebase — proof server, indexer, node, wallet, the Creva API, the
advisor model — returns a typed degraded result rather than throwing or inventing an answer.

## How we built it

Five Compact circuits, a TypeScript client, a chain-agnostic anchoring port, a local AI advisor and
an installable PWA, in six npm workspaces:

- **`contract/`** — `backing.compact`, `backing-tier.compact`, `identity-check.compact`,
  `Attestation.compact` and a Schnorr-over-JubJub verifier. Compact **0.31.1**, pinned on purpose:
  0.34.0 requires ledger 9, whose proof server only exists as a release candidate.
- **`api/`** — the Midnight client: typed proof ports with four implementations behind one
  interface (`stub`, `real` in Node, `bridge` over local HTTP, `lace` browser-direct through the
  DApp connector), plus deploy/join/call wrappers. `midnight.js` 4.1.1, proof server 8.0.3.
- **`anchoring/`** — the blinded commitment scheme and an `AnchoringPort` with Cardano (transaction
  metadata) and EVM (calldata) adapters, both written against a minimal submitter interface.
- **`advisor/`** — the AI track. A local tier advisor whose predictor posts `{ tier }` — *only* the
  derived tier — to a local inference process on `127.0.0.1`, and falls back to a deterministic
  table when it is unreachable. No private financial value ever reaches a hosted model. In a
  privacy hackathon, shipping the private number to somebody's cloud is the own-goal the judges
  will ask about.
- **`web/`** — an installable PWA in plain TypeScript and Vite, no framework: a 164 kB shell,
  32.5 kB of JS (11.1 kB gzipped) in the default build. Contrast and overflow are measured with
  axe-core at 320 / 375 / 390 px in both themes, with fonts loaded and animation settled — measuring
  a fade-in mid-flight reports a contrast nobody ever sees.

The whole thing was written during the event: **109 commits**, the first at 12:47 EDT on Friday,
and **743 tests across 55 files** — unit, fuzz (`fast-check`) and invariant — green on the last run
before submission.

## What we measured

Everything below is wall-clock on the target machine, not an estimate, and every number is
reproducible from the repository (`tools/PROOF-LATENCY.md`):

| Step | Measured |
|---|---|
| `proveBacking` (no in-circuit signature) | **23.76 s** / **23.69 s** — two independent harnesses |
| `proveIdentity` (Schnorr verified in-circuit) | **23.65 s** |
| `proveIdentity` with an issuer the deployment does not know | **0.245 s** → `degraded`, never `false` |
| Contract deploy | ~19.5 s |
| Local environment cold start | ~52 s |
| ZK artifacts served to the browser | **2.2 MB** (149 kB / 688 kB / 1.35 MB prover keys) |

Two of those rows are the whole story, and we cover them under *What we learned*.

## Challenges we ran into

**The bug that ate five rounds.** Every circuit *call* failed with `expected instance of
StateValue`, while deploy succeeded every time. It was not the circuit and not our wiring:
`node_modules` held **two copies of `@midnight-ntwrk/onchain-runtime-v3`** — `compact-runtime`
allows `^3.0.0` so npm hoisted 3.1.0, while `midnight-js-protocol` pins exactly 3.0.0 and got a
nested copy. That package ships a WASM module whose classes are compared with `instanceof`, so two
copies are two distinct `StateValue` classes. Only the scoped call transaction crosses the
boundary, which is why deploy looked healthy. The fix is `overrides` **plus** `npm dedupe` —
`overrides` alone equalises the versions but still leaves two directories, and two directories are
still two module instances. We bisected it by re-running with each candidate change already applied
and watching them all fail, which is the only reason we know the runtime was the cause and not the
three plausible things we had changed alongside it.

**Compact 0.31.1 has no signature-verification primitive.** Verifying an attestation inside a
circuit needs one, so we took the Schnorr-over-JubJub polyfill from Midnight's own
`example-zkloan` (Apache-2.0, declared below), and made two changes: we factored the challenge hash
out into an exported pure circuit, so the off-chain issuer can *ask the contract* for the challenge
rather than reimplementing Compact's `transientHash` in TypeScript; and we made it generic over the
message length instead of fixed at `Vector<4>`, which had it hashing a different struct than the
verifier was checking. Reimplementing a hash on the other side of a language boundary is a bug
generator, and it had already generated one.

**The wallet.** Lace Midnight Preview would not mount at all on preprod for most of Saturday. The
full list, with what we tried, is in the sponsor-feedback answer.

**Three infrastructure papercuts, none documented.** `compact update` fails on a fresh Ubuntu 24.04
because it shells out to `unzip`, which is not installed — and the error reads *"Failed to spawn
artifact extraction command"*, which sounds like a missing artifact and is a missing extractor.
npm 11 refuses install scripts until approved by name, so `classic-level`, `esbuild` and `@swc/core`
fail later, wearing a "module not found" disguise. And `testkit-js` captures `process.cwd()` when
its module is first evaluated, so the demo worked from the `api` workspace and failed from the repo
root — `process.chdir()` cannot fix it, because it runs after the capture.

**The private-state LevelDB takes an exclusive lock**, and the second process to want it dies at
*deploy* time rather than at startup. So a proof server can look healthy for minutes and fall over
on the browser's first request — which, on a recording day, is the exact moment the camera is on.
It is written at the top of our demo runbook in red for that reason.

## What we learned

**In-circuit signature verification did not cost proving time.** We predicted the identity proof
would be slower than the backing proof, wrote that prediction into the README, and were wrong:
23.65 s against 23.70 s, on a prover key **nine times larger** (1.35 MB against 149 kB). The cost
of verifying a signature inside a ZK proof landed on *bytes downloaded once*, not on *seconds
waited every time*. That inverts the design advice we started the weekend with. For a PWA aimed at
mid-range Android phones it means the right thing to optimise is first-load weight — which is why
the service worker deliberately does **not** precache the 2 MB of keys, and fetches them only when
a proof actually starts.

**"I could not check" is a different answer from "no", and the type system should say so.** An
attestation signed by an unknown issuer comes back in 245 ms — two orders of magnitude below a real
proof — because `verifyAttestation` asserts inside the circuit and the call never reaches the
prover. Getting that back as `degraded` rather than `false` is the difference between an honest
product and one that quietly denies people credit when its own infrastructure is down. Once we
modelled it that way at the port, every screen, every retry and every test got easier.

**A privacy claim is only as good as the test that fails when it stops being true.** The one line
we would keep from this weekend is the invariant test, not any circuit.

## What's next

Measure `proveBackingTier` end-to-end (the four-rung ladder compiles but has no TypeScript binding
yet), get a real issuer signature from a KYC provider instead of a synthetic key, and put a real
chain client behind the anchoring adapters. The native Android path through the Kuira SDK is the
post-hackathon road, not the weekend one.

## Prior-work declaration

Submitted to the **Integrate Midnight** track, where prior work is allowed when declared.

- **What existed before:** Creva, a financial platform for women entrepreneurs in Mexico. This
  repository contains **none of its code**; it consumes Creva as an external system through its
  public API, behind a single adapter.
- **What was written during the event:** everything in this repository — the Compact circuits, the
  witnesses, the Midnight client, the interface, and the anchoring port.
- **Scaffold:** the project structure starts from
  [`midnightntwrk/example-bboard`](https://github.com/midnightntwrk/example-bboard) (Apache-2.0),
  Midnight's official example.
- **Reused circuit code:** `contract/src/schnorr.compact` is
  [`midnightntwrk/example-zkloan`](https://github.com/midnightntwrk/example-zkloan)'s
  `contract/src/schnorr.compact` (Apache-2.0), with the two changes described above. Compact 0.31.1
  has no signature-verification primitive, so this polyfill is the official example's answer to
  that gap, not ours.

## What it does *not* do

Stated so the demo is not read as more than it is:

- **Not a cross-chain bridge.** A commitment is anchored; nothing moves between chains, and no
  adapter is wired to a live chain client.
- **Not a native app.** It is an installable PWA.
- **Testnet only.** No key with value touches this repository.
- **The attestation issuer is synthetic.** Creva's KYC provider signs nothing today, so the
  deployment issues its own Schnorr key. The signature *check* is real and runs inside the circuit.
- **The tier ladder is not bound yet.** `proveBackingTier` is compiled but has no compiled-contract
  binding, so a cleared backing proof reports `bronze` — the strongest tier a boolean circuit
  proves.
- **No lending catalogue is connected.** The offers screen shows the proven tier and says plainly
  that there is no offer. An invented rate ends a fintech.
- **No cryptographic audit.** It is a weekend prototype.
- **Every value on screen is synthetic.** None of it belongs to a real person.

---

## 3 · Built with

Devpost allows 25 tags. These are 22, all of them things actually in the repository:

```
compact
midnight
midnight.js
zero-knowledge
zk-snarks
plonk
schnorr
jubjub
typescript
node.js
vite
vitest
fast-check
pwa
service-worker
web-crypto
docker
wsl
lace-wallet
cardano
evm
axe-core
```

⚠️ Do **not** tag `react`, `next.js` or `tailwind`. The web workspace is plain TypeScript on Vite
with no framework, and a tag that does not match the repository is the cheapest possible way to
lose a judge's trust.

---

## 4 · Image gallery

Devpost wants JPG/PNG/GIF, ≤5 MB, 3:2 for best results, up to 15. **The first image is the
thumbnail** — it is what shows in the gallery listing, so it carries the most weight.

### Use the attached images for

| Slot | Image | Note |
|---|---|---|
| App icon / thumbnail mark | The Creva mark — rounded red-gradient tile with the white **C** | Already the brand mark this project inherits; matches `web/public/icons/` |
| Nothing else | — | see the warning below |

⚠️ **Do not upload the "Perfil" screenshot as it stands.** Two reasons, and the first is
non-negotiable: it shows a **real email address** (`alsg013@gmail.com`) on a real account. This
project's own rule is that no value on screen belongs to a real person, and a Devpost gallery is
public and indexable. Redact it — or better, do not use that screen at all: it is a screen of
*Creva*, the prior product, not of Creva ZK, and mixing them muddies exactly the boundary the
prior-work declaration exists to draw.

### Shot list to capture (in this order)

All from the running PWA, on the `bridge` path, at a phone viewport (375 px) so the mobile track
reads from the images alone:

1. **The split before/after screen.** This is the thumbnail candidate if you can get one clean
   frame — it makes the whole point without text.
2. **The backing result**, showing the tier chip and the SYNTHETIC badge.
3. **The identity screen mid-proof** (`generating`), so the 24 s wait is visible and honest.
4. **A `degraded` screen** — `proof_server_unreachable` is the easiest to provoke — with its
   "nobody could check" copy and its retry.
5. **The offers screen**, showing the tier and the plain statement that no catalogue is connected.
6. **A terminal frame of `npm run demo:identity`**, showing `23.65 s → ok` and
   `0.245 s → degraded` on consecutive lines. One screenshot that proves the two headline claims.
7. *(optional)* **The anchoring commitment**, if there is a clean way to show a hash going out and
   nothing else.

Everything visible must carry the SYNTHETIC badge. Frames in `.claude/frames/` are from an
unrelated app and must not be used.

The demo video already exists at `web/creva-zk-final.mp4` (7 MB) — that goes in the **video** field,
not the gallery.

---

## 5 · "Tell us more about your experience working with Midnight."

Paste as-is.

---

Honest version, because you asked for both halves.

### What we liked

**The disclosure model is the best thing here, and it is a language feature, not a library.** Being
forced to write `disclose(...)` around anything derived from a witness means the privacy boundary
is checked by the compiler instead of by code review. We shipped a real privacy invariant on a
weekend, with no cryptographer on the team, and the reason is that the compiler refused to let us
leak by accident. Every other ZK stack we have looked at makes that a discipline; Compact makes it
a compile error.

**`example-bboard` and `example-zkloan` are worth more than the prose docs.** Both ran, both were
readable, and `example-zkloan`'s Schnorr polyfill answered a question the documentation does not
address at all. When we hit the WASM runtime bug, the reason we could diagnose it was that
`example-bboard`'s lockfile resolved a single copy and ours did not — a working reference is a
debugging tool.

**The local `undeployed` network ships a funded genesis wallet.** After a weekend of faucet
cooldowns, that one design decision is what kept Friday from being a total loss.

### The Lace issues, in the order we hit them

1. **Lace Midnight Preview would not mount on preprod at all.** The panel half-rendered. The cause
   was in its own service worker console: the extension fetches
   `https://blockfrost.lw.iog.io/midnight-preprod/` for its Terms & Conditions, and **its own CSP
   does not include that host** — the allowlist has `cardano-preprod.blockfrost.io`,
   `maestro.lw.iog.io`, `*.midnight.network` and `localhost:6300/8088/9944`, but not
   `blockfrost.lw.iog.io`. The fetch fails and the UI stops half-built. It is **not fixable from
   Settings**, because the CSP lives in the extension manifest. It cost us most of Saturday, and it
   resolved itself about 17 hours later without us touching anything — presumably an extension
   update. A wallet whose failure mode is a blank panel with the reason buried in a service-worker
   console is a wallet a hackathon team will abandon before it finds the cause.
2. **The network id Lace reports is not knowable from any installed package.** We needed to compare
   the wallet's network against the one the build expects, and no type, constant or doc told us
   what string Lace Midnight Preview actually sends for preprod. We ended up logging what it
   reports on every connection and making the expected value an environment variable
   (`VITE_LACE_NETWORK_ID`) rather than a constant, because we could not know it ahead of time.
   Publishing that string, or exposing it as a typed enum member, would remove a whole class of
   `wallet_wrong_network` false alarms.
3. **`Refilling (167h51min)` reads like a blocker and is not one.** That is the time to fill the
   25,000 tDUST tank, not a wait before you can sign — 359 tDUST already transacts fine. Nothing in
   the UI distinguishes those, and at 2 a.m. it looks exactly like "come back in a week".
4. **Getting funded is a three-step chain, and only one step is documented well.** The preprod
   faucet dispenses **tNIGHT**, with a **24-hour cooldown per request**; the address must be the
   Midnight one (`mn_addr_preprod…`) and not the Cardano one — which is the single most reported
   mistake in the forum; and receiving NIGHT is not enough, you must **delegate** it to generate
   the DUST that actually pays fees. We were eventually funded through the Google Cloud for Web3
   Midnight faucet, a different path with no cooldown, which we found by accident. There are open
   forum threads from people whose tDUST simply never arrived.
5. **Lace needs a local proof server on `:6300` to sign anything**, configured under
   *Settings » Midnight » Local*, and its version has to match the network's. That is one line in
   the docs and it is the only line about Lace in them. We pinned proof server **8.0.3** for this
   reason and lost time before we understood why the version mattered.
6. **The browser-direct path can join a contract but not deploy one**, so we had to write an
   operator-only deploy screen ourselves, behind a build flag and a URL parameter, just to obtain a
   contract address without a Docker machine present.
7. **Three browser papercuts the SDK could absorb**, each of which cost a debugging round:
   `fetch` must be `bind`-ed before being handed to the ZK config provider or it throws *Illegal
   invocation*; the SDK's network id has to be set **before** the browser providers are built, not
   after; and parsing a bech32 address in the browser needs a `Buffer` global that nothing in the
   dependency chain installs.

### The one that was not Lace's fault but hurt most

**A duplicated WASM runtime silently breaks every circuit call while leaving deploy working.**
`compact-runtime@0.16.0` depends on `@midnight-ntwrk/onchain-runtime-v3@^3.0.0` (npm hoists 3.1.0);
`midnight-js-protocol@4.1.1` pins exactly `3.0.0` and receives a nested copy. That package's WASM
classes are compared with `instanceof`, so two copies mean two `StateValue` classes, and every call
dies with `expected instance of StateValue` from inside
`midnight-js-contracts/src/internal/transaction.ts`. Nothing in that error points at
`node_modules`. It cost us five debugging rounds and it is the single highest-value thing that
could be fixed upstream — either by aligning the ranges, or by making the runtime throw an error
that names the duplication.

### What would make it better

1. **Publish a version-compatibility matrix.** Compact ↔ ledger ↔ proof server ↔ `midnight.js` ↔
   Lace. We pinned Compact at 0.31.1 because 0.34.0 needs ledger 9 and its proof server exists only
   as a release candidate — and we worked that out from release notes and forum posts, not from a
   table. On a 48-hour clock, an hour spent on a version matrix is an hour not spent building.
2. **Align the `onchain-runtime-v3` ranges, or detect the duplication and say so.**
3. **Document `unzip` as a prerequisite.** `compact update` shells out to it, a fresh Ubuntu 24.04
   does not ship it, and the resulting error names the artifact rather than the extractor.
4. **Ship, or point at, an official Windows path.** There is no Compact binary for Windows. WSL is a
   fine answer, but discovering it, plus the fact that `node_modules` serves exactly one platform so
   the whole toolchain must live on one side of the boundary, is a solid hour of a weekend.
5. **Let Lace tell a DApp its network id in a documented, typed way**, and surface its own failures
   in its UI rather than in a service-worker console.

---

## 6 · "What was the most interesting thing you learned at the Midnight Hackathon?"

Paste as-is.

---

**That verifying a signature inside the circuit was free — and that we only found out because we
measured a claim we had already written down as fact.**

We built two circuits on the same primitive. `backing.compact` reads one witness and compares it to
a public argument. `identity-check.compact` verifies a full Schnorr-over-JubJub signature *inside
the proof* before evaluating its predicate. Every intuition we had said the second would be
dramatically slower, and we wrote that into the README as an explanation for why we had not
measured it yet.

Then we measured it: **23.65 s for the identity proof against 23.70 s for the backing proof**, on a
prover key **nine times larger** — 1.35 MB against 149 kB. The signature verification is real and
it is not free, but its cost went almost entirely into the *prover key*, downloaded once, and
almost none of it into the *proving time*, paid on every single use.

That changes what you optimise. We are shipping an installable PWA aimed at mid-range Android
phones, and we had been treating circuit complexity as a latency budget. It is a **bandwidth**
budget. So the service worker deliberately does not precache the 2.2 MB of keys — putting them into
the install would damage the very thing installing is meant to prove — and they are fetched only
when a proof actually begins.

The second-most interesting thing came from the same run. An attestation signed by an issuer the
deployment does not know comes back in **245 milliseconds**, two orders of magnitude faster than a
real proof, because the assertion fails inside the circuit and the call never reaches the prover.
That timing is a design gift: *"I cannot verify who signed this"* is structurally, observably a
different event from *"she does not qualify"* — so we made the port return `degraded`, never
`false`. In credit, that distinction is the whole ethical difference between a system that is
honest about its own outages and one that quietly denies people money when its infrastructure is
down.

We came to a privacy hackathon expecting to learn about privacy. We left having learned that the
measurement you skip is the one that was going to change your architecture.

---

## 7 · Pre-submit checklist

| # | Check | Done |
|---|---|---|
| 1 | Prior-work declaration in the Devpost form, the `README.md` **and** the first 15 s of the video | ⏳ |
| 2 | Track selected: **Integrate Midnight** (plus AI, Mobile, Cross-Chain) | ⏳ |
| 3 | Repository URL public, `AGENTS.md` / `CLAUDE.md` / `docs/` still gitignored | ⏳ |
| 4 | Video uploaded (`web/creva-zk-final.mp4`) and playable from a private browser window | ⏳ |
| 5 | Gallery images carry the SYNTHETIC badge and no real email address | ⏳ |
