<!-- api/README.md -->
The Midnight client for this repository: the typed proof ports `web/` consumes, the four
implementations behind them (stub, real, bridge, lace), the deploy/join/call wrappers for the
backing and identity circuits, and a local HTTP proof server that puts a live proof within reach
of a browser. The `real` port deploys and calls both circuits in Node; the `lace` port joins the
backing contract from the browser. Everything external here returns a typed degraded result
rather than throwing.

# `@creva-zk/api`

## The proof ports

Two ports, one per predicate, each taking exactly its circuit's public arguments and returning
`ApiResult<T>` — a value or a typed degraded result, never a throw.

| Port | Circuit | Signature |
|---|---|---|
| `BackingProofPort` | `proveBacking` | `checkBacking(requestedLimit: bigint) => ApiResult<Tier>` |
| `IdentityProofPort` | `proveIdentity` | `checkIdentity(issuerKey, expectedTaxIdHash) => ApiResult<boolean>` |

Three implementations, selected by `web/`'s seam (`web/src/proofPort.ts`) through
`VITE_PORT_SOURCE`:

- **`stub`** (default) — deterministic outcomes from the public arguments alone. No network.
- **`real`** — the in-process implementation, and the one that runs the circuits. Node only: it
  starts the local network, deploys `backing.compact` and `identity-check.compact` and calls
  `proveBacking` / `proveIdentity`, so it reaches
  `node:` modules and Docker-backed containers. It is not exported from `@creva-zk/api` at all —
  it lives behind `@creva-zk/api/real`, so no browser build can reach it.
- **`bridge`** — browser-safe. One `fetch` per call to the proof server below, which is backed by
  the `real` port. It imports nothing from `node:` and nothing that reaches testcontainers.
- **`lace`** — the browser-direct path, behind `@creva-zk/api/lace`. It builds the six providers
  in the page from Lace's own configuration, then **joins** the backing contract at an address
  the build supplies and calls `proveBacking` through the same `contract.ts` wrappers the `real`
  port uses. It never deploys. See [`web/README.md`](../web/README.md).

### What the real port proves today

| Port | State |
|---|---|
| `createRealBackingPort` | **Wired.** Deploys once, then calls `proveBacking` per request. |
| `createRealIdentityPort` | **Wired.** Deploys `identity-check.compact` once, then calls `proveIdentity` per request. Answers only for the issuer key it signed with — see below. |
| `createLaceBackingPort` | **Wired.** Joins at `contractAddress`, then calls `proveBacking`. |
| `createLaceIdentityPort` | **Degraded.** The binding exists, but the browser-direct path has no identity contract to join. |

### Deploy once, join many

`contract.ts` exports both halves and one call path:

| Function | Who runs it | Cost |
|---|---|---|
| `deployBacking` | the CLI, once (`npm run demo --workspace api`) | ~19s |
| `joinBacking` | every browser, per session | an indexer round trip |
| `callProveBacking` | both | ~23.7s (measured, backing only) |

`callProveBacking` takes a `FoundBacking`, not a `DeployedBacking`: a deployment is a found
contract, so one call path serves the process that deployed and the browser that joined.

`joinBacking` bounds its own wait (`DEFAULT_JOIN_TIMEOUT_MS`, 20s) because `findDeployedContract`
waits on `watchForDeployTxData`, and an address with nothing at it never answers "no" — it simply
never answers.

A malformed address, an empty one, an indexer that never answers and a contract whose verifier keys
do not match this build are all one thing to the user — `contract_not_found` — and the raw cause
goes to the logger.

The browser joining rather than deploying is a product decision, not a plumbing one: deploying in
the page would cost her the ~19s *and* a signature on a deployment that is not hers. See
[`web/README.md`](../web/README.md).

`proveBacking` answers a `Boolean`: the collateral cleared the requested limit, or it did not. It
carries no tier ladder — that is `backing-tier.compact`'s `proveBackingTier`.

So a cleared proof is reported as **the lowest tier the proof actually supports**, `bronze`
(`TIER_PROVEN_BY_CLEARED_BACKING`), and a proof that does not clear as `none`. Reporting `silver`
to match the stub would be claiming more than the circuit proved.

### What `proveIdentity` proves, and what it does not

`identity-check.compact` has a TypeScript binding: `contract/src/identity.ts` exports the compiled
contract and its `identityAttestation` witness, and `realIdentityPort.ts` deploys it and calls
`proveIdentity` per request. The blocker that used to hold it back — no signer on Midnight's own
curve — is gone:

`attestation/src/signing.ts` signs **Schnorr over Jubjub** with the Compact runtime's own curve
operations, and it obtains the challenge by calling the contract's `identityAttestationChallenge`
pure circuit rather than reimplementing Compact's `transientHash` in TypeScript. Signer and
verifier therefore agree by construction.

**The issuer is synthetic.** Creva's KYC provider signs nothing today, so the deployment issues
its own Schnorr key and attests to a claim that belongs to nobody (`api/src/identityClaim.ts`).
What is *not* synthetic is the verification: `verifyAttestation` runs inside the circuit on
every proof. An attestation signed by a different issuer makes the circuit **abort**, and that
comes back as a typed **degraded** result — never as `false`. "Nobody could check" and "the
check ran and the answer is no" stay two different answers.

**The issuer key is per process, and nothing serves it over HTTP.** `realIdentityIssuerKey()`
returns the key the deployment signed with, but it is only reachable in-process (via
`@creva-zk/api/real`); `POST /proof/identity` takes an issuer key and hands none back. So a
`bridge` caller holding a hard-coded key — which is what `web/` sends — hits the abort case and
sees `degraded`. Fixing that means either pinning `issuerSecretKey` on both sides or serving the
key; neither is done, and this file will not pretend otherwise.

`proveBackingTier` is still not reachable from TypeScript: `backing-tier.compact` has no
compiled-contract binding yet. That is a plumbing gap now, not a missing signer.

### The collateral is fixed at deploy time

The deployment holds the collateral as witness-only private state, so it is a port option
(`collateralAmount`, default `5000n` — synthetic) and not a per-call argument. Only the requested
limit, the circuit's public argument, varies from call to call.

## Running the proof server

```bash
npm run serve --workspace api
```

That is the whole command. It listens on **`http://localhost:8787`** (override with
`PROOF_SERVER_PORT`) and exposes one endpoint per predicate:

| Endpoint | Request body | Response body |
|---|---|---|
| `POST /proof/backing` | `{ "requestedLimit": "3000" }` | `ApiResult<Tier>` |
| `POST /proof/identity` | `{ "issuerKey": { "x": "…", "y": "…" }, "expectedTaxIdHash": "…" }` | `ApiResult<boolean>` |

`requestedLimit` travels as a decimal string: it is a `Uint<64>` and does not survive JSON's
number type. The issuer key's `x` and `y` travel the same way, for the same reason — they are
`Field` elements. The key is the (x, y) pair `proveIdentity` takes, not a compressed point:
nothing on either side of this boundary decompresses anything.

Then point the screens at it:

```bash
VITE_PORT_SOURCE=bridge npm run dev --workspace web
```

**Only one process may run at a time.** The private-state store is a LevelDB that takes an
exclusive lock, and the server holds it for as long as it runs — do not run `npm run demo` (or a
second server) alongside it. A second process degrades rather than sharing it. `SIGINT`/`SIGTERM`
close the listener and then tear the deployment down, so the lock is released for the next
process; killing the server with `SIGKILL` leaves it held until the container is reaped.

### One deployment, many proofs

Starting the network and deploying costs roughly **19 s** on top of each proof (~23.7 s for
backing, **23.65 s** for identity — both measured, and within noise of each other).

The server pays that once: the deployment is memoised for the process lifetime, shared by every
request and by both ports, and concurrent first requests share one in-flight attempt rather than
starting two networks. Nothing is deployed until the first request arrives, so the port binds
immediately instead of after a cold start.

A **degraded** start is deliberately not memoised — a server that outlives a Docker restart picks
it up on the next request. The cost of that choice is that a machine with no Docker at all pays a
fresh failed attempt per request; each one still returns a typed degraded result.

A missing compiled circuit is a degraded result too, not a crash: `contract.ts` is imported
lazily on first deployment, so `npm run serve` starts and answers `contract_not_compiled` on a
machine where `npm run compact:build` has not run.

### Timeouts

A **backing** proof measured **~23.7 s** (23697 ms for the clearing call, 18316 ms for the
non-clearing one), so no default anywhere on this path may be 30 s. That number was measured on
`backing.compact`, which does **no** in-circuit signature verification.

`proveIdentity` does verify a Schnorr signature inside the circuit, so its proof is slower — by how
much is **not measured**, and no number for it is stated here. The server's per-request budget is
180 s and the bridge port's client timeout is 120 s — both a ceiling, not a wait: a server that is
down fails the call immediately.

### With the server down

Nothing throws and nothing hangs. Every failure of the trip — server down, CORS, a non-2xx
answer, a body that is not an `ApiResult`, the timeout — comes back as
`{ status: "degraded", degraded: { step, reason } }`, which the seam renders as the screens'
existing failed-with-retry state.

## Running the demo

```bash
npm run demo --workspace api
```

Starts the local `undeployed` network, deploys `backing.compact`, calls `proveBacking` twice with
synthetic collateral, and prints the measured latency of each call. Requires Docker and the
Compact toolchain; see the root [README](../README.md).
