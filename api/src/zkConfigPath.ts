// api/src/zkConfigPath.ts
// Where NodeZkConfigProvider reads the backing circuit's prover and verifier
// keys from. NODE ONLY — it resolves a filesystem path, which is the one
// thing contract.ts must not do now that a browser imports it too.

import { fileURLToPath } from "node:url";

// Absolute, and deliberately so: this is the directory NodeZkConfigProvider
// reads prover/verifier keys from. The contract's own assets path stays
// relative to it — see contract/src/index.ts.
const ZK_CONFIG_DIR = fileURLToPath(new URL("../../contract/src/managed/backing", import.meta.url));

export function zkConfigPath(): string {
  return ZK_CONFIG_DIR;
}

// Same, for the identity circuit. A second directory rather than a shared
// parent because NodeZkConfigProvider indexes prover keys by circuit name
// under the path it is given, and the two contracts have separate key sets.
const IDENTITY_ZK_CONFIG_DIR = fileURLToPath(
  new URL("../../contract/src/managed/identity-check", import.meta.url),
);

export function identityZkConfigPath(): string {
  return IDENTITY_ZK_CONFIG_DIR;
}
