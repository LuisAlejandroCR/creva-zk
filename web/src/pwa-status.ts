// pwa-status.ts
// Pure copy/state for the install-status banner, kept separate from
// main.ts so it can be unit tested without a DOM or a real ServiceWorker.

export type PwaStatus = {
  readonly state?: 'ready';
  readonly message: string;
};

export function unsupportedStatus(): PwaStatus {
  return { message: 'offline support not available in this browser' };
}

export function readyStatus(): PwaStatus {
  return { state: 'ready', message: 'installable — works offline' };
}

export function failedStatus(): PwaStatus {
  return { message: 'offline support failed to register' };
}
