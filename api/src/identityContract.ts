// api/src/identityContract.ts
// Deploy and call wrappers for the identity circuit, each returning a typed
// degraded result rather than throwing — the same shape contract.ts gives
// the backing circuit. The compiled binding lives in contract/src/identity.ts
// and is imported statically from there.

import {
  deployContract,
  findDeployedContract,
  type DeployedContract,
  type FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { Identity } from "../../contract/src/index.js";
import type { PortLogger } from "./portLogger.js";
import { DEFAULT_JOIN_TIMEOUT_MS, TIMED_OUT, withTimeout } from "./timeouts.js";
import type { ApiDegraded, ApiResult } from "./types.js";
import type { IdentityClaimBytes, IdentitySignedPayload } from "./identityClaim.js";
import type { JubjubPoint } from "./proofPort.js";

export const IDENTITY_CIRCUIT_ID = "proveIdentity";
export const IDENTITY_PRIVATE_STATE_ID = "identityPrivateState";

export type IdentityPrivateState = Identity.IdentityPrivateState;
export type IdentityContract = Identity.IdentityContract;
export type IdentityProviders = MidnightProviders<
  typeof IDENTITY_CIRCUIT_ID,
  typeof IDENTITY_PRIVATE_STATE_ID,
  IdentityPrivateState
>;
export type DeployedIdentity = DeployedContract<IdentityContract>;
// What joining produces. Every deployment is also a found contract, which is
// why the call below takes this and not the narrower type: one call path
// serves the CLI that deployed and the browser that joined.
export type FoundIdentity = FoundContract<IdentityContract>;

// The budget the join spends waiting for the indexer, shared with the
// backing path. Re-exported because callers of joinIdentity look here.
export { DEFAULT_JOIN_TIMEOUT_MS };

// The contract's own challenge circuit, as a function an off-chain signer
// can call. Re-exported so nothing outside contract/ ever reimplements the
// hash it computes — that identity is what makes a signature verifiable.
export const identityAttestationChallenge = (
  payload: IdentitySignedPayload,
  announcement: JubjubPoint,
  issuerKey: JubjubPoint,
): bigint =>
  Identity.identityPureCircuits.identityAttestationChallenge(
    payload as never,
    announcement as never,
    issuerKey as never,
  );

export interface IdentityOutcome {
  // What proveIdentity returned: verified AND of age AND the tax-ID hash
  // matched. It is the circuit's return value, never a ledger read — the
  // ledger holds only a call count on purpose.
  readonly matched: boolean;
  readonly answered: bigint;
}

// Deploys the identity contract holding the given signed attestation as
// witness-only private state. Never throws.
export async function deployIdentity(
  providers: IdentityProviders,
  attestation: Identity.IdentityAttestation,
  logger: PortLogger,
): Promise<ApiResult<DeployedIdentity>> {
  try {
    const deployed = await deployContract(providers, {
      compiledContract: Identity.CompiledIdentityContract,
      privateStateId: IDENTITY_PRIVATE_STATE_ID,
      initialPrivateState: Identity.createIdentityPrivateState(attestation),
    });
    return { status: "ok", value: deployed };
  } catch (error) {
    logger.error?.({ err: error }, "deployContract failed for identity-check");
    return degraded("deploy", "deploy_failed");
  }
}

// Joins an identity contract someone else already deployed, at a known
// address. Never throws: a malformed address, an address with nothing at it,
// an indexer that never answers and a contract whose verifier keys do not
// match this build all come back as the same contract_not_found.
//
// NO `initialPrivateState` IS SUPPLIED, and that is the whole point. The
// attestation is the caller's own private state, and only the issuer that
// signed it can produce one — so the join reads the attestation this browser
// already holds for `identityPrivateState` (the operator's own deployment,
// made from this browser) instead of inventing one the circuit would reject.
// A store that holds none is contract_not_found as well: there is nothing
// here to prove with.
export async function joinIdentity(
  providers: IdentityProviders,
  contractAddress: string,
  logger: PortLogger,
  timeoutMs?: number,
): Promise<ApiResult<FoundIdentity>> {
  const budget = timeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS;
  try {
    assertIsContractAddress(contractAddress);
    const found = await withTimeout(
      findDeployedContract(providers, {
        compiledContract: Identity.CompiledIdentityContract,
        contractAddress,
        privateStateId: IDENTITY_PRIVATE_STATE_ID,
      }),
      budget,
    );
    if (found === TIMED_OUT) {
      logger.error?.({ timeoutMs: budget }, "findDeployedContract never answered for identity-check");
      return degraded("join", "contract_not_found");
    }
    return { status: "ok", value: found };
  } catch (error) {
    logger.error?.({ err: error }, "findDeployedContract failed for identity-check");
    return degraded("join", "contract_not_found");
  }
}

// Calls proveIdentity(issuerKey, expectedTaxIdHash).
//
// A signature the circuit rejects does NOT come back as `matched: false` —
// verifyAttestation asserts, so the proof aborts and this degrades. That is
// the honest reporting: nothing was decided about her identity, and an
// unknown issuer is a different answer from "the claim did not hold".
export async function callProveIdentity(
  deployed: FoundIdentity,
  issuerKey: JubjubPoint,
  expectedTaxIdHash: Uint8Array,
  logger: PortLogger,
): Promise<ApiResult<IdentityOutcome>> {
  try {
    const callTxData = await deployed.callTx.proveIdentity(issuerKey as never, expectedTaxIdHash);
    const ledgerState = Identity.identityLedger(callTxData.public.nextContractState);
    return {
      status: "ok",
      value: { matched: callTxData.private.result, answered: ledgerState.answered },
    };
  } catch (error) {
    logger.error?.({ err: error }, "proveIdentity call failed");
    return degraded("call", "call_failed");
  }
}

export type { IdentityClaimBytes };

function degraded<T>(step: string, reason: ApiDegraded["reason"]): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason } };
}
