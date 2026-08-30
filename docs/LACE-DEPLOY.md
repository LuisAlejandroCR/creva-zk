How to deploy the backing contract from the browser, with the Lace wallet of
whoever is running the demo, when there is no machine with Docker on hand to
run `npm run demo --workspace api`.

This is an operator tool: it is used once, it costs tDUST from your own wallet,
and it creates a new contract every time it runs. The user never sees this
screen and cannot reach it.

# Deploying the contract from Lace

## When to use this

The `lace` path **joins** a contract that already exists; it never deploys one
by itself. Without `VITE_BACKING_CONTRACT_ADDRESS` the app degrades with
`contract_not_found` and never reaches a real proof. There are two ways to get
that address:

| Path | What it needs | When it is the right one |
| --- | --- | --- |
| `npm run demo --workspace api` | Docker and the local network | The normal path; it also measures latency |
| This tool | Only Lace, with tDUST and its local proof server | No Docker around, or you want to deploy on preprod with your own wallet |

## Requirements

The same ones as the `lace` path (see `web/README.md`), plus one: the wallet
needs **tDUST** on preprod, because a deployment is paid for.

1. Lace in its Midnight Preview build, unlocked and on the test network
   (`preprod`).
2. The local proof server Lace is configured with under *Settings » Midnight »
   Local* (`http://localhost:6300`), running.
3. `npm run compact:build` and `npm run zk:copy --workspace web` already run:
   a deployment needs the circuit keys just like a proof does.

## How it is switched on

The tool is **never** on by default and **never** fires on its own when the app
loads. It is asked for in one of two ways, and in both you still have to press
the button:

```bash
# By build variable
VITE_PORT_SOURCE=lace VITE_LACE_DEPLOY=1 npm run dev --workspace web

# Or, on a build that is already 'lace', by URL parameter
http://localhost:5173/?deploy=1
```

Any other value — `VITE_LACE_DEPLOY=0`, `?deploy=true`, the variable absent —
leaves the app exactly as it is: the normal user journey, with no operator tool
on the page. Tests cover this in `web/test/deployTool.test.ts`.

## What happens when you press it

In order, and each step can fail on its own:

1. Lace is connected and the network is checked. If the wallet is missing,
   locked, or on another network, the screen says so and nothing is deployed.
2. The local proof server is checked for a response.
3. The deployment transaction is built, proved on your local server, **Lace
   asks for a signature**, and the network confirms. This takes minutes, not
   seconds.
4. The screen prints the contract address in a selectable field, with a copy
   button beside it.

The time budget for the whole deployment is five minutes
(`DEFAULT_DEPLOY_TIMEOUT_MS` in `api/src/timeouts.ts`): longer than the proof
(~19 s), longer than the two minutes a person is given to read the signing
dialog, plus the network's confirmation.

If it runs out, the screen says `deploy_failed` — and warns you to check
whether the contract deployed before paying for another one, because a
transaction already sent can still confirm later.

## What to do with the address

```bash
VITE_PORT_SOURCE=lace \
VITE_BACKING_CONTRACT_ADDRESS=<the address the screen printed> \
  npm run build --workspace web
```

Save it before closing the tab. **Do not deploy again**: every deployment
creates another contract and costs tDUST again.

## Possible failures

None of them is an exception: they are all typed degraded results, and they are
all reasons that already existed on the `lace` path. Not one was invented for
this screen.

| Reason | What produces it |
| --- | --- |
| `wallet_absent` | There is no Midnight wallet in this browser |
| `wallet_locked` | Lace is installed but did not hand over a usable connection |
| `wallet_wrong_network` | Lace is connected to another network |
| `proof_server_unreachable` | The local proof server did not answer |
| `deploy_failed` | Not enough tDUST, the signature was rejected, or the time budget ran out |
| `contract_not_compiled` | This build is missing the output of `npm run compact:build` |
| `environment_unavailable` | This is not a `VITE_PORT_SOURCE=lace` build |

## What this tool does not touch

The user's journey. Without the variable and without the parameter, `main.ts`
mounts exactly what it mounted before, and the tool's code is not even loaded:
it lives behind a dynamic `import()` that is only reached when somebody asked
for it.
