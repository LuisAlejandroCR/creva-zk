Measured proof latency for the backing circuit, and the root cause of the
"expected instance of StateValue" failure that blocked every circuit call for
five rounds. The cause was a duplicated WASM runtime in node_modules, not the
circuit and not the api/ wiring. Every number in this file was taken on
backing.compact; the identity circuit is not measured here.

# Proof latency

## What was measured

`proveBacking`, on `backing.compact`, and **only** that. `backing.compact` has
no in-circuit signature verification: it reads one witness, compares it to a
public argument and discloses the outcome.

`proveIdentity` (`identity-check.compact`) is wired to TypeScript and runs —
see `api/README.md` — but it verifies a Schnorr-over-Jubjub signature *inside*
the proof, which `backing.compact` never does. Its latency is therefore
higher, and it has **not** been measured. No number below applies to it, and
none is quoted for it anywhere in this repository.

## The numbers

Two independent runs, one through example-bboard's harness on the target
machine, one through our own `api/` demo. They agree.

| | example-bboard harness | our `npm run demo` |
|---|---|---|
| environment cold start | 55243 ms | 52547 ms |
| `deployContract` | 19137 ms | 19532 ms |
| **`proveBacking` call** | **23760 ms** | **23687 ms** / 23170 ms |

Our demo times two calls against two separate deploys, so neither reuses a
warm prover. Both assert the public ledger: collateral 5000 vs limit 3000
gives `cleared: true`, collateral 1000 vs limit 3000 gives `cleared: false`,
`answered: 1` in each.

**~24 s per backing call, well under the 48.4 s reference upper bound and
nowhere near 90 s.** The two-minute demo video is filmable as designed —
filming an identity proof would need a measurement that does not exist yet.

## The root cause

`node_modules` held **two copies of `@midnight-ntwrk/onchain-runtime-v3`**:

```
3.1.0  node_modules/@midnight-ntwrk/onchain-runtime-v3                     (hoisted)
3.0.0  node_modules/@midnight-ntwrk/midnight-js-protocol/node_modules/...  (nested)
```

`compact-runtime@0.16.0` depends on `^3.0.0`, so npm hoisted 3.1.0;
`midnight-js-protocol@4.1.1` pins exactly `3.0.0` and got a nested copy. That
package ships a **WASM module whose classes are compared with `instanceof`**.
Two copies means two distinct `StateValue` classes, so:

```
new ChargedState(stateValue)
  -> _assertClass(stateValue, StateValue)   // onchain_runtime_wasm_bg.js
  -> Error: expected instance of StateValue
```

The failing frame is `TransactionContextImpl[MergeUnsubmittedCallTxData]` in
`midnight-js-contracts/src/internal/transaction.ts:165` — inside the scoped
call transaction, which is why **deploy succeeded and only the call failed**,
on every attempt, regardless of how the contract was wired.

example-bboard works because its lockfile resolves a single copy at 3.0.0.

### The fix

Pin one copy, matching the resolution the working harness has:

```jsonc
// package.json
"overrides": { "@midnight-ntwrk/onchain-runtime-v3": "3.0.0" }
```

then `npm dedupe` to collapse the two directories into one hoisted copy.
`overrides` alone is not enough — it equalises the versions but still leaves
two directories, and two directories are still two module instances.

## What was NOT the cause

Bisected directly: the run immediately before the dedupe already had both of
the structural changes below applied, and still failed with the identical
error. The run immediately after the dedupe succeeded. Nothing else changed.

- **Static import + generic instantiation** of the generated contract
  (`Generated.Contract<BackingPrivateState>` instead of a cast through
  `unknown`). Kept anyway: it is the shape example-bboard uses, and it let
  every `as never` / `as unknown` cast come out of `api/src/contract.ts`.
- **Relative `withCompiledFileAssets("./managed/backing")`**. Kept, for the
  same reason — it is correct, it was just not the bug.
- Wallet dust `additionalFeeOverhead`, the `index.cjs` → `index.js` path, the
  missing `compose.yml`, pino's error key, and an uninitialised `Counter`:
  all real defects, all fixed in earlier commits, none of them this one.
- An earlier draft of this file claimed passing `callTxData.public.nextContractState`
  to `ledger()` was a type error. It is not: the generated
  `ledger(state: StateValue | ChargedState)` accepts it. That claim was wrong.

## Two other real fixes found while measuring

- **`compose.yml` resolution.** testkit-js captures `process.cwd()` when its
  module is first evaluated, so the demo only worked when launched from the
  `api` workspace and failed from the repo root with `open compose.yml: no
  such file or directory`. `process.chdir()` cannot fix this — it runs after
  that capture. `api/src/localEnvironment.ts` now pins the directory through
  testkit's own `setContainersConfiguration`.
- **Exit code.** The demo set `process.exitCode = 1` on a degraded result,
  which pino's pino-pretty transport worker could land ahead of, and a throw
  from `run()` bypassed entirely. Both would have turned a CI gate green on a
  broken demo. Now: `.catch()` to a degraded result, then explicit
  `process.exit(1)`.

## The independent reproduction

`tools/measure-proof-latency.sh` still runs the whole measurement through
example-bboard's harness in a scratch dir outside this repo. It is kept
deliberately: a second, independent path to the number is worth more than the
small duplication in `tools/harness/`.

```bash
npm run measure     # via the bboard-cli harness
npm run demo        # via our own api/ workspace
```

Both need Docker running and `compact` on PATH; `npm run measure` also needs
example-bboard checked out (`BBOARD_REF=`, default
`/root/midnight-refs/example-bboard`).
