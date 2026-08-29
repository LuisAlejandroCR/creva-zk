<!-- api/README.md -->
The Midnight client for this repository: the typed proof ports `web/` consumes, the three
implementations behind them (stub, real, bridge), the deploy/call wrappers for the backing
circuit, and a local HTTP proof server that puts a live proof within reach of a browser.
Everything external here returns a typed degraded result rather than throwing.

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
- **`real`** — the in-process implementation. Node only: its call path reaches `node:` modules
  and Docker-backed containers, so importing it in a browser fails at import.
- **`bridge`** — browser-safe. One `fetch` per call to the proof server below. It imports
  nothing from `node:` and nothing that reaches testcontainers.

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
exclusive lock, and the server holds it — do not run `npm run demo` (or a second server)
alongside it.

### Timeouts

A proof measured **~23.7 s** (23697 ms for the clearing call, 18316 ms for the non-clearing one),
so no default anywhere on this path may be 30 s. The server's per-request budget is 180 s and the
bridge port's client timeout is 120 s — both a ceiling, not a wait: a server that is down fails
the call immediately.

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
