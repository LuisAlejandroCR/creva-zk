# `@creva-zk/contract`

Owns the Compact circuit: `backing.compact`, the backing predicate that compares a private
collateral amount against a public requested limit and discloses only the outcome. It does not own
the identity predicate (not implemented in this workspace yet), the Midnight client, or any
TypeScript consumer of the generated APIs — those live in other workspaces.

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
npm run compact --workspace contract   # compiles src/backing.compact -> src/managed/backing
npm run typecheck --workspace contract
```

Requires the Compact toolchain pinned at `0.31.1` (see the root README for why). The local
`undeployed` network used for development ships a funded genesis wallet, so no faucet is needed.

`backing.compact` has no in-circuit signature verification: its prover key is 145 KB. A circuit that
adds in-circuit signature verification (e.g. the identity predicate, once written) compiles to a
672 KB prover key.
