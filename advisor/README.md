advisor/README.md
Contrato del workspace del asesor: qué posee, qué no, y por qué el modelo solo
ve el tramo derivado. La regla que gobierna este directorio es que ningún dato
financiero privado sale del dispositivo hacia un modelo alojado.

# `@creva-zk/advisor`

Owns the local tier advisor for the Integrate Midnight AI track: `AdvisorPort.advise` takes exactly
one field, the derived backing tier, and returns guidance text with `offerAvailable` always `false`
since no lender catalogue is connected. It does not own the backing circuit, the collateral amount,
or any hosted/third-party model call — `LocalTierPredictor` implementations may only call a local
inference process, never a hosted API.

## Predictors

`LocalTierAdvisor` calls `createLocalModelPredictor()` by default, which posts `{ tier }` to a local
HTTP process (`http://127.0.0.1:8477/predict` unless overridden) and falls back to `stubPredictor`,
a deterministic guidance table, when that process is unreachable or returns an unexpected shape.

## Build

```bash
npm run build --workspace advisor
npm run typecheck --workspace advisor
```
