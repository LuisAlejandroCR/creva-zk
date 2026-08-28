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

- [`contract/`](contract/README.md) — the Compact circuit and its disclosure boundary.
- [`api/`](api/README.md) — shared domain types for the other workspaces. Declared as an npm
  workspace; not implemented yet.
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

### Running it

Requires **Node 24.11.1+**, Docker, and the Compact toolchain pinned at `0.31.1` — `0.34.0` requires
ledger 9, for which no stable proof server exists yet.

**Linux or WSL only** — Compact ships no Windows binary. Two dependencies the official docs don't
mention, without which install fails: `unzip` (`compact update` needs it to unpack the toolchain),
and approving npm 11's install scripts by name: `npm install-scripts approve <pkg>`.

```bash
npm install && npm run verify
```

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

- [`contract/`](contract/README.md) — el circuito Compact y su frontera de divulgación.
- [`api/`](api/README.md) — tipos de dominio compartidos por los demás workspaces. Declarado como
  workspace de npm; aún sin implementar.
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

### Correrlo

Requiere **Node 24.11.1+**, Docker y el toolchain de Compact fijado en `0.31.1` — `0.34.0` exige
ledger 9, para el que todavía no hay un proof server estable.

**Linux o WSL**: el compilador de Compact no publica binario para Windows. Dos dependencias que no
aparecen en la documentación oficial y sin las cuales la instalación falla: `unzip`, y aprobar los
install scripts de npm 11 con `npm install-scripts approve <pkg>`.

```bash
npm install && npm run verify
```

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
