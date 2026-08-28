// api/src/genesisWallet.ts
// Documents the genesis wallet used against the local `undeployed` network.
// PUBLIC TEST CONSTANT — not a secret. It is baked into
// @midnight-ntwrk/testkit-js's LocalTestEnvironment itself (genesisMintWalletSeed[0]),
// pre-funded by the local network's genesis block, and identical for every
// developer who runs this repo. LocalTestEnvironment ignores any seed we
// pass it and always uses this one, so this file exists for documentation
// only — nothing here is read at runtime.

export const LOCAL_GENESIS_WALLET_SEED_LABEL =
  "public test constant: @midnight-ntwrk/testkit-js LocalTestEnvironment.genesisMintWalletSeed[0]" as const;
