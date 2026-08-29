<!-- README.md -->
Front page of the repository, in English and Spanish: what Creva ZK proves, which workspace owns
what, how to run it, and — under "What is measured, and what is not" — exactly which claims here
rest on a measurement and which do not. Every figure quoted below names what it was measured on.

# Creva ZK

**Midnight Hackathon: August 2026** — Major League Hacking.

[English](#english) | [Español](#español) 

---

## English

An entrepreneur applies for a collateralized card and sees what she qualifies for **without handing
anyone her ID or her balance**.

Two zero-knowledge proofs, one primitive: verify a signed attestation inside the circuit, evaluate a
public predicate, and disclose **only the outcome**.

| Proof | Moment | Predicate |
|---|---|---|
| **Backing** | seeing what she qualifies for | collateral ≥ requested limit → tier |
| **Identity** | applying for the card | verified ∧ of age ∧ tax ID matches |

### Workspaces

- [`contract/`](contract/README.md) — the Compact circuits and their disclosure boundary.
- [`api/`](api/README.md) — the Midnight client: the typed proof ports, their stub/real/bridge
  implementations, and the local HTTP proof server the browser reaches through the bridge.
- [`anchoring/`](anchoring/README.md) — chain-agnostic commitment scheme and anchoring port, with
  Cardano and EVM adapters.
- [`advisor/`](advisor/README.md) — local tier advisor for the Integrate Midnight AI track.
- [`web/`](web/README.md) — the installable PWA shell.

### Prior work declaration

Submitted to the **Integrate Midnight** track, where prior work is allowed when declared.

- **What existed before:** Creva, a financial platform for women entrepreneurs in Mexico. This
  repository contains **none of its code**; it consumes Creva as an external system through its
  public API, behind a single adapter.
- **What was written during the event:** everything in this repository — the Compact circuit, the
  witnesses, the Midnight client, the interface, and the anchoring port.
- **Scaffold:** the project structure starts from
  [`midnightntwrk/example-bboard`](https://github.com/midnightntwrk/example-bboard) (Apache-2.0),
  Midnight's official example.
- **Reused circuit code:** `contract/src/schnorr.compact` is
  [`midnightntwrk/example-zkloan`](https://github.com/midnightntwrk/example-zkloan)'s
  `contract/src/schnorr.compact` (Apache-2.0). Compact
  0.31.1 has no signature-verification primitive yet, so this Schnorr-over-JubJub polyfill is the
  official example's answer to that gap, not ours. Two changes of ours: the challenge hash is
  factored out of `schnorrVerify` into an exported `schnorrChallenge` pure circuit, so the
  off-chain issuer can obtain the challenge by calling the contract rather than by reimplementing
  Compact's `transientHash` in TypeScript; and that circuit is generic over the message length
  rather than fixed at `Vector<4>`, which had it hashing a different struct than the verifier.

### Running it

Requires **Node 24.11.1+**, Docker, and the Compact toolchain pinned at `0.31.1` — `0.34.0` requires
ledger 9, for which no stable proof server exists yet.

**Linux or WSL only** — Compact ships no Windows binary. Two dependencies the official docs don't
mention, without which install fails: `unzip` (`compact update` needs it to unpack the toolchain),
and approving npm 11's install scripts by name: `npm install-scripts approve <pkg>`.

```bash
npm install && npm run verify
```

Once the circuit is compiled, `npm run demo` deploys `backing.compact` on the local
`undeployed` network, calls `proveBacking` twice with synthetic collateral, and prints
proof latency in milliseconds for each call.

**Measured: ~23.7 s per *backing* proof**, on top of a ~52 s environment cold start and a ~19.5 s
deploy. Reproduced independently through
[`example-bboard`](https://github.com/midnightntwrk/example-bboard)'s own harness with
`npm run measure`. See [`tools/PROOF-LATENCY.md`](tools/PROOF-LATENCY.md) for both runs
and for the duplicated-WASM-runtime bug that blocked every circuit call until it was
pinned in `overrides`.

### What is measured, and what is not

| Claim | Status |
|---|---|
| `proveBacking` latency, ~23.7 s | **Measured**, twice, on two independent harnesses. |
| `proveIdentity` latency | **Not measured.** The 23.7 s figure was taken on `backing.compact`, which does **no** in-circuit signature verification. `identity-check.compact` verifies a Schnorr signature inside the proof, so it is slower — by how much, this repository does not know and does not guess. |
| `proveIdentity` wired to TypeScript | **Yes** — `contract/src/identity.ts` binds the compiled circuit, `api/src/realIdentityPort.ts` deploys it and calls it. |
| The identity attestation's issuer | **Synthetic.** Creva's KYC provider signs nothing today; the deployment issues its own Schnorr key. The *signature check* is real and runs inside the circuit. |
| An attestation from a different issuer | **Aborts the proof** and returns a typed `degraded` result — never `false`. "Nobody could check" is not "the answer is no". |
| The identity screen in the browser | **Still degrades on every real source.** On `bridge` the browser's hard-coded issuer key is not the server's per-process one; on `lace` there is no identity contract address to join. See [`web/README.md`](web/README.md). |
| `proveBackingTier` | **Not reachable from TypeScript** — `backing-tier.compact` has no compiled-contract binding yet. |
| The circuits | **No cryptographic audit.** |

`verify` compiles the circuit before typechecking: the compiler generates the TypeScript APIs the
rest of the workspace compiles against.

### What it does **not** do

- **Not** a cross-chain bridge. A commitment is anchored; nothing moves between chains.
- **Not** a native app. It is an installable PWA.
- Runs on **testnet**, never mainnet.
- Weekend prototype. The circuit has **no** cryptographic audit.
- Every value on screen is **synthetic**. None belongs to a real person.

---

## Español

Una emprendedora pide una tarjeta colateralizada y ve a qué califica **sin entregarle a nadie su
documento ni su saldo**.

Dos pruebas de conocimiento cero, un mismo primitivo: verificar una atestación firmada dentro del
circuito, evaluar un predicado público, y divulgar **solo el desenlace**.

| Prueba | Momento | Predicado |
|---|---|---|
| **Respaldo** | ver a qué califica | colateral ≥ límite solicitado → tramo |
| **Identidad** | pedir la tarjeta | verificada ∧ mayor de edad ∧ RFC coincide |

### Workspaces

- [`contract/`](contract/README.md) — los circuitos Compact y su frontera de divulgación.
- [`api/`](api/README.md) — el cliente de Midnight: los puertos de prueba tipados, sus
  implementaciones (stub, real, bridge, lace) y el servidor HTTP de pruebas local que el navegador
  alcanza por el bridge.
- [`anchoring/`](anchoring/README.md) — esquema de compromiso y puerto de anclaje agnóstico de
  cadena, con adaptadores para Cardano y EVM.
- [`advisor/`](advisor/README.md) — asesor local de tramo para el track Integrate Midnight AI.
- [`web/`](web/README.md) — la shell de la PWA instalable.

### Declaración de trabajo previo

Entregado al track **Integrate Midnight**, donde el trabajo previo se permite si se declara.

- **Lo que existía antes:** Creva, una plataforma financiera para mujeres emprendedoras en México.
  Este repositorio **no contiene una línea de su código**: la consume como sistema externo por su
  API pública, detrás de un único adaptador.
- **Lo que se escribió durante el evento:** todo lo que hay en este repositorio — el circuito
  Compact, los witnesses, el cliente de Midnight, la interfaz y el puerto de anclaje.
- **Andamio:** la estructura del proyecto parte de
  [`midnightntwrk/example-bboard`](https://github.com/midnightntwrk/example-bboard) (Apache-2.0),
  el ejemplo oficial de Midnight.
- **Código de circuito reutilizado:** `contract/src/schnorr.compact` es el
  `contract/src/schnorr.compact` de
  [`midnightntwrk/example-zkloan`](https://github.com/midnightntwrk/example-zkloan) (Apache-2.0),
  Compact 0.31.1 todavía no tiene un primitivo de
  verificación de firmas, así que este polyfill de Schnorr sobre JubJub es la respuesta del ejemplo
  oficial a ese vacío, no la nuestra. Dos cambios nuestros: el hash del desafío sale de
  `schnorrVerify` a un circuito puro exportado `schnorrChallenge`, para que el emisor off-chain
  obtenga el desafío llamando al contrato en vez de reimplementar el `transientHash` de Compact en
  TypeScript; y ese circuito es genérico sobre el largo del mensaje en vez de fijo en `Vector<4>`,
  que hacía que hasheara una estructura distinta a la del verificador.

### Correrlo

Requiere **Node 24.11.1+**, Docker y el toolchain de Compact fijado en `0.31.1` — `0.34.0` exige
ledger 9, para el que todavía no hay un proof server estable.

**Linux o WSL**: el compilador de Compact no publica binario para Windows. Dos dependencias que no
aparecen en la documentación oficial y sin las cuales la instalación falla: `unzip`, y aprobar los
install scripts de npm 11 con `npm install-scripts approve <pkg>`.

```bash
npm install && npm run verify
```

Una vez compilado el circuito, `npm run demo` despliega `backing.compact` en la red
local `undeployed`, llama a `proveBacking` dos veces con colateral sintético, e
imprime la latencia de cada prueba en milisegundos.

**Medido: ~23.7 s por prueba de *respaldo***, más ~52 s de arranque en frío del entorno y ~19.5 s
de despliegue. Reproducido de forma independiente con el propio harness de
[`example-bboard`](https://github.com/midnightntwrk/example-bboard) vía `npm run measure`.
Ver [`tools/PROOF-LATENCY.md`](tools/PROOF-LATENCY.md).

### Qué está medido y qué no

| Afirmación | Estado |
|---|---|
| Latencia de `proveBacking`, ~23.7 s | **Medida**, dos veces, en dos harnesses independientes. |
| Latencia de `proveIdentity` | **No medida.** Los 23.7 s se tomaron sobre `backing.compact`, que **no** verifica firmas dentro del circuito. `identity-check.compact` sí verifica una firma Schnorr dentro de la prueba, así que tarda más — cuánto más, este repositorio no lo sabe y no lo inventa. |
| `proveIdentity` con binding de TypeScript | **Sí** — `contract/src/identity.ts` liga el circuito compilado y `api/src/realIdentityPort.ts` lo despliega y lo llama. |
| El emisor de la atestación de identidad | **Sintético.** El proveedor KYC de Creva no firma nada hoy; el despliegue genera su propia llave Schnorr. La *verificación de la firma* sí es real y ocurre dentro del circuito. |
| Una atestación de otro emisor | **Aborta la prueba** y devuelve un resultado `degraded` tipado — nunca `false`. "Nadie pudo verificar" no es "la respuesta es no". |
| La pantalla de identidad en el navegador | **Sigue degradando en toda fuente real.** En `bridge`, la llave de emisor fija del navegador no es la que el servidor genera por proceso; en `lace` no hay dirección de contrato de identidad a la cual unirse. Ver [`web/README.md`](web/README.md). |
| `proveBackingTier` | **No alcanzable desde TypeScript** — `backing-tier.compact` todavía no tiene binding de contrato compilado. |
| Los circuitos | **Sin auditoría criptográfica.** |

`verify` compila el circuito **antes** de typechequear: el compilador genera las APIs de TypeScript
contra las que compila el resto.

### Qué **no** hace

- **No** es un puente cross-chain. Se ancla un compromiso; nada se mueve entre cadenas.
- **No** es una app nativa. Es una PWA instalable.
- Corre en **testnet**, nunca en mainnet.
- El circuito es un prototipo de fin de semana y **no** tiene auditoría criptográfica.
- Todos los datos que se ven en pantalla son **sintéticos**. Ninguno pertenece a una persona real.

---

Licensed under [Apache-2.0](LICENSE).
