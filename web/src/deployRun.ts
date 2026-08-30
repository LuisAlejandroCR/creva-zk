// deployRun.ts
// The operator deployment's state machine, kept free of the DOM and of real
// timers so its one guarantee is testable directly: nothing is deployed
// until run() is called, and calling it twice while one is in flight starts
// no second deployment — a duplicate press would cost tDUST twice and leave
// two contracts behind.

import type { ApiFailureReason, ApiResult } from '@creva-zk/api';

export type DeployPhase = 'idle' | 'running' | 'done' | 'degraded';

export interface DeployState {
  readonly phase: DeployPhase;
  /** Only a `done` deployment has one: the address to paste into a build. */
  readonly address?: string;
  /** Only a `degraded` deployment has one: why it did not happen. */
  readonly reason?: ApiFailureReason;
}

export interface DeployController {
  readonly state: () => DeployState;
  readonly run: () => Promise<DeployState>;
}

export interface DeployControllerOptions {
  /** The deployment itself. Assumed to be able to take minutes. */
  readonly deploy: () => Promise<ApiResult<{ readonly contractAddress: string }>>;
  /** Every state the deployment passes through, in order. */
  readonly emit: (state: DeployState) => void;
}

// Constructing a controller deploys nothing. That is the whole point of the
// split: the screen can be built, rendered and re-rendered as often as it
// likes, and the wallet is only ever asked for a signature by run().
export function createDeployController(options: DeployControllerOptions): DeployController {
  let state: DeployState = { phase: 'idle' };

  function settle(next: DeployState): DeployState {
    state = next;
    options.emit(next);
    return next;
  }

  return {
    state: () => state,
    async run(): Promise<DeployState> {
      // A second press while the first deployment is still in flight is
      // ignored rather than queued: the cost of getting this wrong is a
      // second contract nobody asked for.
      if (state.phase === 'running') return state;
      settle({ phase: 'running' });

      let result: ApiResult<{ readonly contractAddress: string }>;
      try {
        result = await options.deploy();
      } catch {
        // The action is contracted to degrade rather than throw, so reaching
        // here means something below broke that contract. It is still not an
        // exception the screen has to handle.
        return settle({ phase: 'degraded', reason: 'deploy_failed' });
      }

      if (result.status === 'degraded') {
        return settle({ phase: 'degraded', reason: result.degraded.reason });
      }
      return settle({ phase: 'done', address: result.value.contractAddress });
    },
  };
}
