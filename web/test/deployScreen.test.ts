// deployScreen.test.ts
// The operator screen's contract with whoever reads it: every failure is a
// state, never an exception; a finished backing deployment prints the address
// and says to put it in VITE_BACKING_CONTRACT_ADDRESS; a finished identity
// deployment prints the address AND the issuer key and says both are needed;
// and every state says the tool is an operator tool on a test network that
// spends tDUST.

import { describe, expect, it } from 'vitest';
import { createDeployController, type DeployState } from '../src/deployRun';
import {
  buildDeployContent,
  renderDeployScreen,
  DEPLOY_ADDRESS_ROLE,
  DEPLOY_ISSUER_KEY_ROLE,
} from '../src/deployScreen';

const SYNTHETIC_ADDRESS = 'ab'.repeat(32);
// Synthetic on purpose: two small decimals, not a real curve point.
const SYNTHETIC_ISSUER_KEY = '11:22';

function screenFor(state: DeployState): string {
  return renderDeployScreen(buildDeployContent(state));
}

describe('the finished backing state hands over the address and what to do with it', () => {
  const html = screenFor({ phase: 'done', target: 'backing', address: SYNTHETIC_ADDRESS });

  it('prints the address in a field that can be selected and copied', () => {
    expect(html).toContain(`data-role="${DEPLOY_ADDRESS_ROLE}"`);
    expect(html).toContain(`value="${SYNTHETIC_ADDRESS}"`);
    expect(html).toContain('readonly');
    expect(html).toContain('Copiar dirección');
  });

  it('says where the address goes and that the app has to be rebuilt', () => {
    expect(html).toContain('VITE_BACKING_CONTRACT_ADDRESS');
    expect(html).toContain('npm run build --workspace web');
    expect(html).toContain('vuelve a construir');
  });

  it('warns that deploying again costs again', () => {
    expect(html).toContain('cuesta tDUST otra vez');
  });

  it('shows no issuer key, because a backing deployment has none', () => {
    expect(html).not.toContain(`data-role="${DEPLOY_ISSUER_KEY_ROLE}"`);
  });
});

describe('the finished identity state hands over BOTH values', () => {
  const state: DeployState = {
    phase: 'done',
    target: 'identity',
    address: SYNTHETIC_ADDRESS,
    issuerKey: SYNTHETIC_ISSUER_KEY,
  };
  const html = screenFor(state);

  it('prints the address and the issuer key, each copiable', () => {
    expect(html).toContain(`data-role="${DEPLOY_ADDRESS_ROLE}"`);
    expect(html).toContain(`data-role="${DEPLOY_ISSUER_KEY_ROLE}"`);
    expect(html).toContain(`value="${SYNTHETIC_ADDRESS}"`);
    expect(html).toContain(`value="${SYNTHETIC_ISSUER_KEY}"`);
    expect(html).toContain('Copiar llave del emisor');
  });

  it('names both build variables', () => {
    expect(html).toContain('VITE_IDENTITY_CONTRACT_ADDRESS');
    expect(html).toContain('VITE_IDENTITY_ISSUER_KEY');
  });

  it('says the key is decimal (x, y), never a compressed point', () => {
    expect(html).toContain('x:y');
    expect(html).toContain('decimal');
  });

  it('says why the key is not optional', () => {
    expect(buildDeployContent(state).body).toContain('sin la llave del emisor el circuito aborta');
  });

  it('says the attestation is synthetic and stays in this browser', () => {
    expect(html).toContain('sintéticos');
    expect(html).toContain('ESTE navegador');
  });
});

describe('every state names the tool for what it is', () => {
  const states: readonly DeployState[] = [
    { phase: 'idle', target: 'backing' },
    { phase: 'running', target: 'backing' },
    { phase: 'running', target: 'identity' },
    { phase: 'done', target: 'backing', address: SYNTHETIC_ADDRESS },
    { phase: 'done', target: 'identity', address: SYNTHETIC_ADDRESS, issuerKey: SYNTHETIC_ISSUER_KEY },
    { phase: 'degraded', target: 'identity', reason: 'deploy_failed' },
  ];

  for (const state of states) {
    it(`says operator tool and test network on the ${state.phase}/${state.target} state`, () => {
      const html = screenFor(state);
      expect(html).toContain('Herramienta de operador');
      expect(html).toContain('red de prueba');
      // Not a step of the journey: no step indicator anywhere on it.
      expect(html).not.toContain('class="stepper"');
    });
  }
});

describe('the idle screen offers both deployments and prices them first', () => {
  const content = buildDeployContent({ phase: 'idle', target: 'backing' });

  it('offers one button per contract', () => {
    expect(content.actions.map((action) => action.target)).toEqual(['backing', 'identity']);
  });

  it('says each one costs tDUST before either is asked for', () => {
    expect(content.body).toContain('cuesta tDUST');
    expect(content.body).toContain('identidad');
  });

  it('renders each button carrying the target it starts', () => {
    const html = renderDeployScreen(content);
    expect(html).toContain('data-target="backing"');
    expect(html).toContain('data-target="identity"');
  });
});

describe('each failure is its own state with its own copy', () => {
  const reasons = [
    ['wallet_absent', 'cartera de Midnight instalada'],
    ['wallet_locked', 'no entregó una conexión'],
    ['wallet_wrong_network', 'otra red'],
    ['proof_server_unreachable', 'servidor de pruebas'],
    ['deploy_failed', 'tDUST'],
    ['contract_not_compiled', 'compact:build'],
    ['environment_unavailable', 'VITE_PORT_SOURCE=lace'],
  ] as const;

  for (const [reason, fragment] of reasons) {
    it(`renders ${reason} as its own explanation with a retry`, () => {
      const content = buildDeployContent({ phase: 'degraded', target: 'backing', reason });
      expect(content.tone).toBe('error');
      expect(content.body).toContain(fragment);
      expect(content.actions).toEqual([{ target: 'backing', label: 'Reintentar' }]);
      expect(content.address).toBeUndefined();
    });
  }

  it('retries the deployment that failed, never the other one', () => {
    const content = buildDeployContent({ phase: 'degraded', target: 'identity', reason: 'deploy_failed' });
    expect(content.actions).toEqual([{ target: 'identity', label: 'Reintentar' }]);
  });

  it('still says something when the reason is missing', () => {
    const content = buildDeployContent({ phase: 'degraded', target: 'backing' });
    expect(content.body.length).toBeGreaterThan(0);
  });
});

describe('the controller turns every outcome into a state, never a throw', () => {
  it('reports a degraded deployment as a degraded state carrying the reason', async () => {
    const states: string[] = [];
    const controller = createDeployController({
      deploy: async () => ({ status: 'degraded', degraded: { step: 'deployBacking', reason: 'wallet_locked' } }),
      emit: (state) => states.push(state.phase),
    });
    await expect(controller.run()).resolves.toEqual({ phase: 'degraded', target: 'backing', reason: 'wallet_locked' });
    expect(states).toEqual(['running', 'degraded']);
  });

  it('reports a deployment that threw as degraded rather than rejecting', async () => {
    const controller = createDeployController({
      deploy: async () => {
        throw new Error('the action broke its own never-throw contract');
      },
      emit: () => undefined,
    });
    await expect(controller.run()).resolves.toEqual({
      phase: 'degraded',
      target: 'backing',
      reason: 'deploy_failed',
    });
  });

  it('reports a successful deployment as the address it produced', async () => {
    const controller = createDeployController({
      deploy: async () => ({ status: 'ok', value: { contractAddress: SYNTHETIC_ADDRESS } }),
      emit: () => undefined,
    });
    await expect(controller.run()).resolves.toEqual({
      phase: 'done',
      target: 'backing',
      address: SYNTHETIC_ADDRESS,
    });
  });

  it('carries the issuer key back from an identity deployment', async () => {
    const controller = createDeployController({
      deploy: async (target) => ({
        status: 'ok',
        value: {
          contractAddress: SYNTHETIC_ADDRESS,
          ...(target === 'identity' ? { issuerKey: SYNTHETIC_ISSUER_KEY } : {}),
        },
      }),
      emit: () => undefined,
    });
    await expect(controller.run('identity')).resolves.toEqual({
      phase: 'done',
      target: 'identity',
      address: SYNTHETIC_ADDRESS,
      issuerKey: SYNTHETIC_ISSUER_KEY,
    });
  });

  it('starts no second deployment while one is in flight, on either target', async () => {
    let started = 0;
    const controller = createDeployController({
      deploy: async () => {
        started += 1;
        return new Promise(() => undefined);
      },
      emit: () => undefined,
    });
    void controller.run('backing');
    await controller.run('identity');
    expect(started).toBe(1);
  });
});
