// deployTool.test.ts
// The guarantee the whole feature rests on: without the explicit opt-in
// there is no deployment tool and nothing is deployed. Every combination
// that is not the exact opt-in is asserted to leave the app as it was, and
// the controller is asserted to deploy nothing until run() is called.

import { describe, expect, it, vi } from 'vitest';
import { isDeployToolRequested } from '../src/deployTool';
import { createDeployController } from '../src/deployRun';

describe('the deployment tool is off unless it is asked for', () => {
  it('is off on an ordinary load: no flag, no query string', () => {
    expect(isDeployToolRequested({}, '')).toBe(false);
    expect(isDeployToolRequested(undefined, undefined)).toBe(false);
  });

  it('is off for every value of the flag that is not exactly "1"', () => {
    for (const value of ['', '0', 'false', 'true', 'yes', 'on', '1 ', ' 1']) {
      expect(isDeployToolRequested({ VITE_LACE_DEPLOY: value }, '')).toBe(false);
    }
  });

  it('is off for a query string that names something else, or names it with another value', () => {
    for (const search of ['?deploy=0', '?deploy', '?deploy=true', '?source=lace', '?deployment=1', '?nodeploy=1']) {
      expect(isDeployToolRequested({}, search)).toBe(false);
    }
  });

  it('is off for the ordinary journey even on a lace build with a contract address', () => {
    // The two variables the journey itself reads never turn the tool on.
    expect(isDeployToolRequested({} as Record<string, string>, '?VITE_PORT_SOURCE=lace')).toBe(false);
  });

  it('is on for the build flag set to "1"', () => {
    expect(isDeployToolRequested({ VITE_LACE_DEPLOY: '1' }, '')).toBe(true);
  });

  it('is on for ?deploy=1, alone or among other parameters', () => {
    expect(isDeployToolRequested({}, '?deploy=1')).toBe(true);
    expect(isDeployToolRequested({}, '?utm=x&deploy=1&other=2')).toBe(true);
  });
});

describe('nothing is deployed until the operator asks', () => {
  it('deploys nothing when the controller is merely created', () => {
    const deploy = vi.fn(async () => ({ status: 'ok', value: { contractAddress: 'ab' } }) as const);
    createDeployController({ deploy, emit: () => undefined });
    expect(deploy).not.toHaveBeenCalled();
  });

  it('deploys once, and only once, however many times the button is pressed while it runs', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deploy = vi.fn(async () => {
      await gate;
      return { status: 'ok', value: { contractAddress: 'ab' } } as const;
    });
    const controller = createDeployController({ deploy, emit: () => undefined });

    const first = controller.run();
    const second = controller.run();
    expect(deploy).toHaveBeenCalledTimes(1);

    release?.();
    await Promise.all([first, second]);
    expect(deploy).toHaveBeenCalledTimes(1);
  });
});
