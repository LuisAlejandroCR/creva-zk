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

Requires **Node 24.11.1+**, Docker, and the Compact toolchain pinned at `0.31.1`. Linux or WSL only —
Compact ships no Windows binary.

```bash
npm install && npm run verify
```

Once the circuit is compiled, `npm run demo` deploys `backing.compact` on the local
`undeployed` network, calls `proveBacking` twice with synthetic collateral, and prints
proof latency in milliseconds for each call — the number that decides whether the demo
video is filmable in two minutes.

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

Requiere **Node 24.11.1+**, Docker y el toolchain de Compact fijado en `0.31.1`.

**Linux o WSL**: el compilador de Compact no publica binario para Windows. Dos dependencias que no
aparecen en la documentación oficial y sin las cuales la instalación falla: `unzip`, y aprobar los
install scripts de npm 11 con `npm install-scripts approve <pkg>`.

```bash
npm install && npm run verify
```

Una vez compilado el circuito, `npm run demo` despliega `backing.compact` en la red
local `undeployed`, llama a `proveBacking` dos veces con colateral sintético, e
imprime la latencia de cada prueba en milisegundos.

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
