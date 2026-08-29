// contract/src/index.ts
// Binds the compiled circuit to its witnesses and its ZK assets, once, at
// module scope. Built here rather than in api/ so that the assets path stays
// relative to the generated output, the way midnight-js resolves it.

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/backing/contract/index.js";
export * from "./witnesses.js";
// Namespaced: the identity binding's generated module exports the same names
// (Contract, Ledger, pureCircuits) as the backing one, so it cannot be flat.
export * as Identity from "./identity.js";

import * as Generated from "./managed/backing/contract/index.js";
import * as Witnesses from "./witnesses.js";

// `Generated.Contract<BackingPrivateState>` is an instantiation expression,
// not a cast: it pins the generated class's private-state type parameter at
// the point the constructor is handed to CompiledContract.make. Passing the
// bare constructor (or one cast through `unknown`) erases that binding, and
// the runtime then fails to build the circuit's state encoders — which is
// what produced "expected instance of StateValue" on every call.
export const CompiledBackingContract = CompiledContract.make<
  Generated.Contract<Witnesses.BackingPrivateState>
>("backing", Generated.Contract<Witnesses.BackingPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  // Relative on purpose. midnight-js resolves this against the base path each
  // service is given (the NodeZkConfigProvider directory), so an absolute
  // path here bypasses that resolution.
  CompiledContract.withCompiledFileAssets("./managed/backing"),
);
