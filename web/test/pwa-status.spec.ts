// pwa-status.spec.ts
// Unit tests for the install-status banner logic in src/pwa-status.ts:
// each outcome gets the right message, and only "ready" carries a state.

import { describe, expect, it } from 'vitest';
import { failedStatus, readyStatus, unsupportedStatus } from '../src/pwa-status';

describe('pwa install status', () => {
  it('unsupportedStatus carries no state and says so', () => {
    const status = unsupportedStatus();
    expect(status.state).toBeUndefined();
    expect(status.message).toBe('este navegador no admite el modo sin conexión');
  });

  it('readyStatus is the only outcome marked ready', () => {
    const status = readyStatus();
    expect(status.state).toBe('ready');
    expect(status.message).toBe('instalable — funciona sin conexión');
  });

  it('failedStatus carries no state and says registration failed', () => {
    const status = failedStatus();
    expect(status.state).toBeUndefined();
    expect(status.message).toBe('no se pudo activar el modo sin conexión');
  });
});
