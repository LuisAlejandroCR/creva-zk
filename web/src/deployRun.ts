// deployRun.ts
// The operator deployments' state machine, kept free of the DOM and of real
// timers so its one guarantee is testable directly: nothing is deployed
// until run() is called, and calling it twice while one is in flight starts
// no second deployment — a duplicate press would cost tDUST twice and leave
// two contracts behind. One controller drives both targets, backing and
// identity, so a press on either is covered by that same guarantee.

import type { ApiFailureReason, ApiResult } from '@creva-zk/api';

export type DeployPhase = 'idle' | 'running' | 'done' | 'degraded';

/** Which contract a run deploys. Both cost tDUST and both create a contract. */
export type DeployTarget = 'backing' | 'identity';

export interface DeployState {
  readonly phase: DeployPhase;
  /** Which deployment this state is about; 'backing' before anything is run. */
  readonly target: DeployTarget;
  /** Only a `done` deployment has one: the address to paste into a build. */
  readonly address?: string;
  /**
   * Only a finished IDENTITY deployment has one: the issuer key, decimal
   * "x:y". The address alone is not enough — the circuit verifies the
   * attestation's signature against this key.
   */
  readonly issuerKey?: string;
  /** Only a `degraded` deployment has one: why it did not happen. */
  readonly reason?: ApiFailureReason;
}

export interface DeployController {
  readonly state: () => DeployState;
  readonly run: (target?: DeployTarget) => Promise<DeployState>;
}

/** What a deployment hands back: an address, plus an issuer key for identity. */
export interface DeployProduct {
  readonly contractAddress: string;
  readonly issuerKey?: string;
}

export interface DeployControllerOptions {
  /** The deployment itself. Assumed to be able to take minutes. */
  readonly deploy: (target: DeployTarget) => Promise<ApiResult<DeployProduct>>;
  /** Every state the deployment passes through, in order. */
  readonly emit: (state: DeployState) => void;
}

// Constructing a controller deploys nothing. That is the whole point of the
// split: the screen can be built, rendered and re-rendered as often as it
// likes, and the wallet is only ever asked for a signature by run().
export function createDeployController(options: DeployControllerOptions): DeployController {
  let state: DeployState = { phase: 'idle', target: 'backing' };

  function settle(next: DeployState): DeployState {
    state = next;
    options.emit(next);
    return next;
  }

  return {
    state: () => state,
    async run(target: DeployTarget = 'backing'): Promise<DeployState> {
      // A second press while the first deployment is still in flight is
      // ignored rather than queued — on either target: the cost of getting
      // this wrong is a second contract nobody asked for, paid for twice.
      if (state.phase === 'running') return state;
      settle({ phase: 'running', target });

      let result: ApiResult<DeployProduct>;
      try {
        result = await options.deploy(target);
      } catch {
        // The action is contracted to degrade rather than throw, so reaching
        // here means something below broke that contract. It is still not an
        // exception the screen has to handle.
        return settle({ phase: 'degraded', target, reason: 'deploy_failed' });
      }

      if (result.status === 'degraded') {
        return settle({ phase: 'degraded', target, reason: result.degraded.reason });
      }
      return settle({
        phase: 'done',
        target,
        address: result.value.contractAddress,
        ...(result.value.issuerKey === undefined ? {} : { issuerKey: result.value.issuerKey }),
      });
    },
  };
}
