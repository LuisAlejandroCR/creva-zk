<!-- contract/README.md -->
Owns the Compact sources of this repository and the TypeScript bindings the compiler emits for
them: the backing predicate, the identity predicate, and the Schnorr/Attestation building blocks
both share. It does not own the Midnight client, the proof ports, or any application consumer of
the generated APIs — those live in `api/` and `web/`.

# `@creva-zk/contract`

Two predicates are compiled here. `backing.compact` compares a private collateral amount against
a public requested limit and discloses only the outcome. `identity-check.compact` verifies a
signed attestation inside the circuit and discloses a single boolean. Both are bound to
TypeScript: `src/index.ts` for backing, `src/identity.ts` for identity — separate modules because
the two generated contracts export the same names, so only one of them can be re-exported flat.

`backing-tier.compact` compiles, but has **no** compiled-contract binding yet, so
`proveBackingTier` is not reachable from TypeScript.

## Disclosure table

The circuit has exactly one witness and two ledger fields. This table is the whole privacy promise
of the backing predicate — every value the circuit touches, and what happens to it.

| Field | Private | Disclosed | Derived |
|---|---|---|---|
| `collateralAmount` (witness) | ✅ never leaves the device | | |
| `requestedLimit` (circuit input) | | ✅ public parameter | |
| `outcome` (`collateral ≥ requestedLimit`) | | ✅ via `disclose()` | ✅ from `collateralAmount` and `requestedLimit` |
| `cleared` (ledger) | | ✅ public ledger state | ✅ set to `outcome` |
| `answered` (ledger counter) | | ✅ public ledger state | ✅ incremented once per call, carries no amount |

## Signing an attestation the circuit will accept

`verifyAttestation` hashes twice before it checks anything: once over the `SignedPayload<T>`, and
once over the Schnorr challenge input. An off-chain issuer has to compute both to produce a
signature the circuit accepts, and computing them by reimplementing Compact's `transientHash` in
TypeScript is how signer and verifier silently drift apart.

So both are exported as **pure circuits**, and the issuer calls them:

| Compact | Where | Emitted binding |
|---|---|---|
| `schnorrChallenge<#n>` | `schnorr.compact` | none — generic |
| `attestationMessage<T>`, `attestationChallenge<T>` | `Attestation.compact` | none — generic |
| `identityAttestationMessage`, `identityAttestationChallenge` | `identity-check.compact` | `pureCircuits.*` |
| `backingAttestationMessage`, `backingAttestationChallenge` | `backing-tier.compact` | `pureCircuits.*` |

Only the concrete instantiations get a TypeScript binding — Compact emits one for a circuit with no
remaining type parameters, which is why each predicate pins the generic pair at its own claim type.
`schnorrVerify` computes its own challenge by calling `schnorrChallenge`, so there is exactly one
definition of the challenge in the system and the two sides agree by construction rather than by
two copies of a formula kept in step by hand.

`<predicate>AttestationChallenge` composes both hashes, so a signer needs that one call and never
has to know how the claim is encoded. Wiring, once `npm run compact:build` has produced
`src/managed/identity-check`:

```ts
import { pureCircuits } from "./managed/identity-check/contract/index.js";
import { SchnorrAttestationSigner } from "@creva-zk/attestation";

const signer = new SchnorrAttestationSigner<IdentityClaim>(pureCircuits.identityAttestationChallenge);
```

`<predicate>AttestationMessage` is exported alongside it for a caller that needs the message on its
own — building the witness, or debugging a signature the circuit rejected.

The challenge those circuits return is the **full** hash; the signer truncates it to 248 bits, the
same reduction `getSchnorrReduction` supplies to the circuit. That witness is implemented in
`src/schnorrWitness.ts`, which imports nothing from `./managed` so it can be tested before the
toolchain has run.

## Build

```bash
npm run compact:build                  # from the repo root: all three circuits
npm run typecheck --workspace contract
```

`compact:build` runs the three compilations in turn — `src/backing.compact`,
`src/backing-tier.compact` and `src/identity-check.compact` into `src/managed/<name>`. The
identity binding in `src/identity.ts` does not typecheck until the third of those has run.

Requires the Compact toolchain pinned at `0.31.1` (see the root README for why). The local
`undeployed` network used for development ships a funded genesis wallet, so no faucet is needed.

In-circuit signature verification is not free, and the three circuits make the cost visible.
`backing.compact` verifies no signature and its prover key is 149 kB; `backing-tier.compact` does
and its key is 688 kB; `identity-check.compact` does and its key is 1.35 MB. Measured with `du` on
the compiled output, 2026-08-29 — the same numbers the build copies to `web/public/zk`, tabulated
in [`web/README.md`](../web/README.md).

That extra work is also why an identity proof takes **longer** than a backing one. The ~23.7 s
figure in `tools/PROOF-LATENCY.md` was measured on `backing.compact` only. How much longer the
identity proof takes **has not been measured**, and no number for it is stated anywhere in this
repository.
