Measuring proveBacking latency through example-bboard's known-working harness,
because five attempts at our own api/ call path all died on the same error.
This file is the written-down difference list between the working path and
ours — the bisection plan for fixing api/ once a number exists.

# Proof latency via the bboard-cli harness

## The one command

```bash
tools/measure-proof-latency.sh
```

Unattended: no prompts, no input between start and the printed number. Needs
`docker` running, `compact` on PATH, and example-bboard checked out. Defaults
to `/root/midnight-refs/example-bboard`; override with `BBOARD_REF=/path`.
Scratch dir defaults to `/tmp/creva-latency-harness` (`SCRATCH_DIR=` to move).

It copies bboard-cli outside this repo, swaps in `contract/src/backing.compact`,
compiles, deploys, and times exactly one `proveBacking` call. Exits non-zero on
any degraded result. Prints:

```
==================== PROOF LATENCY ====================
  environment cold start : ..... ms
  deployContract         : ..... ms
  proveBacking CALL      : ..... ms   <-- THE NUMBER
```

## What the harness changes (the complete diff vs upstream example-bboard)

Three files, nothing else. No edit to `contract/src/index.ts`, to
`api/src/common-types.ts`, or to any provider wiring — the export *names* in
`witnesses.ts` are deliberately preserved so everything downstream compiles
untouched, and `BBoardCircuitKeys` picks up `"proveBacking"` generically.

| File | Change |
|---|---|
| `contract/src/bboard.compact` | Replaced wholesale with our `backing.compact`. Same path, so `compact compile src/bboard.compact ./src/managed/bboard` needs no edit. |
| `contract/src/witnesses.ts` | `localSecretKey` → `collateralAmount`; `secretKey: Uint8Array` → `secretKey: bigint`. Same destructure-and-return shape. |
| `bboard-cli/src/latency.ts` | New file. Copies `run()`'s setup verbatim, replaces `mainLoop()` with deploy + one timed call. |

Run with `TS_NODE_TRANSPILE_ONLY=true`: upstream's `api/src/*.ts` still
references bulletin-board ledger fields (`state`, `owner`, `sequence`) our
circuit does not have. Those files are not on `latency.ts`'s import path, but
`tsc` would still typecheck them.

## The difference list — working path vs our api/

Ordered most to least suspicious as the cause of
`expected instance of StateValue`. Numbers 3–5 are already fixed on this
branch; 1 and 2 are not, and are the bisection targets.

### 1. How the compiled contract is constructed (NOT yet addressed)

**bboard** — static import, module scope, built once, generic instantiated at
the call site:

```ts
import * as CompiledBBoardContract from "./managed/bboard/contract/index.js";
export const CompiledBBoardContractContract = CompiledContract.make<
  CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState>
>("BBoard", CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/bboard"),
);
```

**ours** — dynamic `await import(url)`, rebuilt on every deploy, constructor
cast through `unknown`:

```ts
const generated = (await import(CONTRACT_MODULE_URL.href)) as GeneratedBackingModule;
const ctor = generated.Contract as unknown as new (w: ...) => BackingContractType;
CompiledContract.make<BackingContractType>("backing", ctor).pipe(...)
```

Note bboard passes `Contract<PrivateState>` — the *generic instantiation* of
the generated class — not the bare constructor. Our cast erases that. This is
the largest remaining structural gap and the first thing to bisect.

### 2. `withCompiledFileAssets` path shape (NOT yet addressed)

bboard passes a **relative** `"./managed/bboard"`. We pass an **absolute** path
from `import.meta.url`. The SDK's own docstring: *"Relative file paths will be
resolved relative to the base paths provided to each service that accesses the
compiled file assets."* An absolute path may bypass that resolution.

### 3. Wallet dust overhead (fixed in `b7b77bb`)

bboard never uses `LocalTestEnvironment.getMidnightWalletProvider()`. It builds
its own provider with
`additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n`.
The testkit default is `0n`. Ours took the convenience path and got `0n`.

### 4. Private-state provider config (fixed)

bboard passes explicit `privateStateStoreName`, `signingKeyStoreName`, and
`accountId: seed`. Ours used library defaults and a constant `accountId`.
Namespacing only — not expected to be causal, listed for completeness.

### 5. Generated module extension (fixed in `0d6393e`)

We pointed at `contract/index.cjs`; the compiler emits `index.js`.

### 6. Reading the result after the call (fixed)

bboard reads the ledger through
`publicDataProvider.queryContractState(addr)` then `ledger(state.data)`. Ours
read `callTxData.public.nextContractState` — which is a `StateValue`, not the
`ContractState` `ledger()` wants. This is *after* the call, so it cannot be the
reported error, but it is a real bug on the same path and `latency.ts` uses
bboard's form.

## Bisecting once a number exists

The harness proves our circuit itself is fine. Then, in order: apply #1 to
`api/src/contract.ts` (static import + generic instantiation, built once at
module scope), re-run `npm run demo`, and if it still fails apply #2. If both
land and the error persists, the assumption to discard is that the fault is in
`api/` wiring at all.
