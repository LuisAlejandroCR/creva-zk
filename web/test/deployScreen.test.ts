// deployScreen.test.ts
// The operator screen's contract with whoever reads it: every failure is a
// state, never an exception; the finished state prints the address in
// something that can be selected and copied and says to put it in
// VITE_BACKING_CONTRACT_ADDRESS and rebuild; and every state says the tool is
// an operator tool on a test network.

import { describe, expect, it } from 'vitest';
import { createDeployController } from '../src/deployRun';
import { buildDeployContent, renderDeployScreen, DEPLOY_ADDRESS_ROLE } from '../src/deployScreen';

const SYNTHETIC_ADDRESS = 'ab'.repeat(32);

function screenFor(state: Parameters<typeof buildDeployContent>[0]): string {
  return renderDeployScreen(buildDeployContent(state));
}

describe('the finished state hands over the address and what to do with it', () => {
  const html = screenFor({ phase: 'done', address: SYNTHETIC_ADDRESS });

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
});

describe('every state names the tool for what it is', () => {
  for (const state of [
    { phase: 'idle' } as const,
    { phase: 'running' } as const,
    { phase: 'done', address: SYNTHETIC_ADDRESS } as const,
    { phase: 'degraded', reason: 'deploy_failed' } as const,
  ]) {
    it(`says operator tool and test network on the ${state.phase} state`, () => {
      const html = screenFor(state);
      expect(html).toContain('Herramienta de operador');
      expect(html).toContain('red de prueba');
      // Not a step of the journey: no step indicator anywhere on it.
      expect(html).not.toContain('class="stepper"');
    });
  }
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
      const content = buildDeployContent({ phase: 'degraded', reason });
      expect(content.tone).toBe('error');
      expect(content.body).toContain(fragment);
      expect(content.ctaLabel).toBe('Reintentar');
      expect(content.address).toBeUndefined();
    });
  }

  it('still says something when the reason is missing', () => {
    const content = buildDeployContent({ phase: 'degraded' });
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
    await expect(controller.run()).resolves.toEqual({ phase: 'degraded', reason: 'wallet_locked' });
    expect(states).toEqual(['running', 'degraded']);
  });

  it('reports a deployment that threw as degraded rather than rejecting', async () => {
    const controller = createDeployController({
      deploy: async () => {
        throw new Error('the action broke its own never-throw contract');
      },
      emit: () => undefined,
    });
    await expect(controller.run()).resolves.toEqual({ phase: 'degraded', reason: 'deploy_failed' });
  });

  it('reports a successful deployment as the address it produced', async () => {
    const controller = createDeployController({
      deploy: async () => ({ status: 'ok', value: { contractAddress: SYNTHETIC_ADDRESS } }),
      emit: () => undefined,
    });
    await expect(controller.run()).resolves.toEqual({ phase: 'done', address: SYNTHETIC_ADDRESS });
  });
});
