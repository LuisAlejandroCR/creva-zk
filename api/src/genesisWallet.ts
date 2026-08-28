// api/src/genesisWallet.ts
// Documents the genesis wallet used against the local `undeployed` network.
// PUBLIC TEST CONSTANT — not a secret. It is read from
// @midnight-ntwrk/testkit-js's LocalTestEnvironment.genesisMintWalletSeed[0]
// at runtime (see localEnvironment.ts), pre-funded by the local network's
// genesis block, and identical for every developer who runs this repo.

export const LOCAL_GENESIS_WALLET_SEED_LABEL =
  "public test constant: @midnight-ntwrk/testkit-js LocalTestEnvironment.genesisMintWalletSeed[0]" as const;
