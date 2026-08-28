// pwa-status.ts
// Pure copy/state for the install-status banner, kept separate from
// main.ts so it can be unit tested without a DOM or a real ServiceWorker.

export type PwaStatus = {
  readonly state?: 'ready';
  readonly message: string;
};

export function unsupportedStatus(): PwaStatus {
  return { message: 'este navegador no admite el modo sin conexión' };
}

export function readyStatus(): PwaStatus {
  return { state: 'ready', message: 'instalable — funciona sin conexión' };
}

export function failedStatus(): PwaStatus {
  return { message: 'no se pudo activar el modo sin conexión' };
}
