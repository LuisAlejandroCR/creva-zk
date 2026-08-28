video-script.md
Two-minute pitch video script as a seconds | on-screen | spoken table.
Narration is in English throughout; every on-screen text element is in
Spanish and stays that way for the whole video.

## Rules this script follows

- 0:00–0:15 names the hackathon and states the prior-work declaration.
- The before/after split screen (0:35–0:55) is built to make the point with
  the sound off: labels and icons only, no narration-dependent detail.
- No latency, benchmark, or unmerged feature is claimed anywhere below —
  every on-screen claim maps to a file in this repository.

## Script

| Seconds | On screen (Spanish) | Spoken (English) |
|---|---|---|
| 0:00–0:08 | Título: "Creva ZK" · "Midnight Hackathon: Agosto 2026 — Major League Hacking" | "This is Creva ZK, built for the Midnight Hackathon, August 2026, Major League Hacking." |
| 0:08–0:15 | "Declaración de trabajo previo: Creva ya existía. Este repositorio no contiene su código — lo consume por su API pública, detrás de un único adaptador." | "Prior-work declaration, up front: Creva, the platform, already existed. This repository contains none of its code — it consumes Creva as an external system, through one adapter." |
| 0:15–0:22 | "Lo escrito durante el evento: el circuito Compact, los witnesses, el cliente de Midnight, la interfaz, el anclaje." | "Everything written during the event is the Compact circuit, the witnesses, the Midnight client, the interface, and the anchoring port." |
| 0:22–0:35 | Pantalla: silueta de una emprendedora + ícono de tarjeta colateralizada. Texto: "Pide una tarjeta colateralizada." | "An entrepreneur applies for a collateralized card. Today, qualifying means showing someone her ID and her balance." |
| 0:35–0:55 | **Pantalla dividida.** Izquierda, encabezado "ANTES": ícono de documento de identidad + ícono de saldo bancario, ambos con un ojo abierto sobre ellos, flecha hacia un ícono de persona/servidor. Derecha, encabezado "CON CREVA ZK": los mismos íconos de documento y saldo, ahora con un candado; una sola flecha sale de una caja "circuito ZK" hacia un resultado: "Tramo: PLATA" o "✔". Nada más en pantalla. | *(No narration for the first 12 seconds — let the split screen read on its own.)* "Same application. On the left, the ID and the balance are exposed. On the right, they never leave the device — the circuit discloses only the outcome." |
| 0:55–1:12 | "Prueba 1 — Respaldo" · fragmento de código: `disclose(collateral >= requestedLimit)` · resultado visible: "NONE · BRONZE · SILVER · GOLD" | "The first proof is Backing. It checks that private collateral clears a public threshold, and discloses only the tier — never the amount." |
| 1:12–1:29 | "Prueba 2 — Identidad" · fragmento de código: `disclose(claim.verified && claim.ofAge && claim.taxId == expectedTaxIdHash)` · resultado visible: "✔ / ✘" | "The second proof is Identity: verified, of age, and tax ID match, combined into one signed check. The chain learns a single boolean — nothing about who she is." |
| 1:29–1:40 | "Ambas pruebas verifican una atestación firmada antes de evaluar el predicado." · diagrama pequeño: emisor firma → witness → circuito → resultado | "Both proofs share one primitive: verify a signed attestation inside the circuit, then evaluate the predicate. That invariant is covered by an automated test, not just a comment." |
| 1:40–1:50 | "Se ancla un compromiso, no el resultado." · ícono de hash → cadena · texto pequeño: "Cardano / EVM, testnet" | "What reaches an external chain is a commitment to the outcome, never the outcome itself — and if that chain is unreachable, the port degrades to a typed result. It never throws, and it never invents a receipt." |
| 1:50–2:00 | "PWA instalable · Testnet · Prototipo de fin de semana, sin auditoría · Todos los datos son sintéticos." | "Creva ZK is an installable PWA, running on testnet, a weekend prototype with no cryptographic audit yet. Every value you saw is synthetic — none of it belongs to a real person." |
