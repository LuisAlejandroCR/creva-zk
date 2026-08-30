anchoring/README.md
Contract for the anchoring workspace: the blinded commitment scheme and the
chain-agnostic port with its two adapters. What reaches an external chain is a
commitment to the outcome, never the outcome, and never anything about identity.

# `@creva-zk/anchoring`

Owns the chain-agnostic anchoring port: a blinded sha256 commitment scheme over a `BackingOutcome`
(tier + timestamp), and the `AnchoringPort` interface with Cardano and EVM adapters that submit a
commitment as transaction metadata/calldata. It does not own a real chain SDK integration — both
adapters are written against a minimal submitter interface (`CardanoTxSubmitter`,
`EvmTxSubmitter`) and take a caller-supplied client; wiring a real one in is out of scope here. It
also has no path for anchoring an identity outcome, by design.

## What it anchors

`commitBackingOutcome` hashes `{tier, timestamp}` together with a random 32-byte blinding factor
that never leaves the caller, so the on-chain commitment alone carries no usable entropy to
brute-force. `verifyBackingCommitment` lets a holder later open the commitment to an auditor by
presenting the outcome and the blinding factor.

## Build

```bash
npm run build --workspace anchoring
npm run typecheck --workspace anchoring
```
