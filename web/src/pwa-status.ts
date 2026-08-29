// pwa-status.ts
// Pure copy/state for the install status, kept separate from main.ts so it
// can be unit tested without a DOM or a real ServiceWorker.
//
// The status is now a lock in the navigation strip rather than a line of its
// own, and the strip is re-rendered with every screen — so the latest status
// is held here and read at render time, instead of being written once into
// markup the next render would throw away.

export type PwaStatus = {
  readonly state?: 'ready';
  readonly message: string;
};

export function checkingStatus(): PwaStatus {
  return { message: 'comprobando compatibilidad de instalación…' };
}

export function unsupportedStatus(): PwaStatus {
  return { message: 'este navegador no admite el modo sin conexión' };
}

export function readyStatus(): PwaStatus {
  return { state: 'ready', message: 'instalable — funciona sin conexión' };
}

export function failedStatus(): PwaStatus {
  return { message: 'no se pudo activar el modo sin conexión' };
}

let current: PwaStatus = checkingStatus();

export function setPwaStatus(status: PwaStatus): void {
  current = status;
}

export function readPwaStatus(): PwaStatus {
  return current;
}
