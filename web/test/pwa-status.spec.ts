// pwa-status.spec.ts
// Unit tests for the install-status banner logic in src/pwa-status.ts:
// each outcome gets the right message, and only "ready" carries a state.

import { describe, expect, it } from 'vitest';
import { failedStatus, readyStatus, unsupportedStatus } from '../src/pwa-status';

describe('pwa install status', () => {
  it('unsupportedStatus carries no state and says so', () => {
    const status = unsupportedStatus();
    expect(status.state).toBeUndefined();
    expect(status.message).toBe('offline support not available in this browser');
  });

  it('readyStatus is the only outcome marked ready', () => {
    const status = readyStatus();
    expect(status.state).toBe('ready');
    expect(status.message).toBe('installable — works offline');
  });

  it('failedStatus carries no state and says registration failed', () => {
    const status = failedStatus();
    expect(status.state).toBeUndefined();
    expect(status.message).toBe('offline support failed to register');
  });
});
