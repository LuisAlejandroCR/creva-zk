devpost.md
Submission text for Devpost, in English. Copy-paste target for the "About the
project" fields: what it is, the two proofs, the before/after, and the
prior-work declaration verbatim from README.md.

## What it is

Creva ZK lets an entrepreneur applying for a collateralized card find out
what she qualifies for **without handing anyone her ID or her balance**.

It is a weekend prototype for the **Midnight Hackathon: August 2026**
(Major League Hacking), submitted to the **Integrate Midnight** track. One
primitive — verify a signed attestation inside a Compact circuit, evaluate a
public predicate, disclose only the outcome — implemented twice, as two
zero-knowledge proofs. It ships as an installable PWA and runs on testnet
only.

## The two proofs

| Proof | Moment | Predicate | What the chain ever learns |
|---|---|---|---|
| **Backing** | seeing what she qualifies for | collateral ≥ requested limit → tier | the tier (NONE / BRONZE / SILVER / GOLD) |
| **Identity** | applying for the card | verified ∧ of age ∧ tax ID matches | a single boolean |

Both circuits (`contract/src/backing-tier.compact`,
`contract/src/identity-check.compact`) take a signed attestation as a
private witness, verify its signature against the issuer's public key
(`contract/src/Attestation.compact`), and `disclose(...)` exactly one
derived value — never the collateral amount, never the identity claim
itself. That invariant is enforced by an automated test
(`contract/test/invariant/witness-never-reaches-the-ledger.invariant.spec.ts`),
not just asserted in a comment.

## Before / after

**Before (how a collateralized-card application works today):** the
applicant hands over her ID document and her account balance to a person or
a backend that can see both, in full, permanently.

**After (with Creva ZK):** the same predicate — does the collateral clear
this limit, does the identity check pass — is evaluated inside a
zero-knowledge circuit on her device. The counterparty learns only the
outcome: a tier, or a boolean. The collateral amount and the identity claim
never leave the device and never reach a ledger. A commitment to the
outcome is what gets anchored, not the outcome itself
(`anchoring/src/commitment.ts`) — and even that anchoring is best-effort: if
the external chain is unreachable, the port returns a typed degraded
result, never a throw and never an invented receipt
(`anchoring/src/types.ts`).

## Prior-work declaration

Verbatim from `README.md`:

> Submitted to the **Integrate Midnight** track, where prior work is allowed when declared.
>
> - **What existed before:** Creva, a financial platform for women entrepreneurs in Mexico. This
>   repository contains **none of its code**; it consumes Creva as an external system through its
>   public API, behind a single adapter.
> - **What was written during the event:** everything in this repository — the Compact circuit, the
>   witnesses, the Midnight client, the interface, and the anchoring port.
> - **Scaffold:** the project structure starts from
>   [`midnightntwrk/example-bboard`](https://github.com/midnightntwrk/example-bboard) (Apache-2.0),
>   Midnight's official example.
> - **Reused circuit code:** `contract/src/schnorr.compact` is
>   [`midnightntwrk/example-zkloan`](https://github.com/midnightntwrk/example-zkloan)'s
>   `contract/src/schnorr.compact` (Apache-2.0), unmodified except for its header comment. Compact
>   0.31.1 has no signature-verification primitive yet, so this Schnorr-over-JubJub polyfill is the
>   official example's answer to that gap, not ours.

## What it does not do

- Not a cross-chain bridge. A commitment is anchored; nothing moves between chains.
- Not a native app. It is an installable PWA.
- Runs on testnet, never mainnet.
- Weekend prototype. The circuit has no cryptographic audit.
- Every value on screen is synthetic. None belongs to a real person.
