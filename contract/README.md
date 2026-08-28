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
