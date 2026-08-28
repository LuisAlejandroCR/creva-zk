// main.ts
// Web workspace entry point: renders the placeholder shell and registers
// the offline service worker, reporting install status in the UI.

import { failedStatus, readyStatus, unsupportedStatus, type PwaStatus } from './pwa-status';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <img class="mark" src="/icons/icon-192.png" alt="" width="64" height="64" />
    <h1>Creva ZK</h1>
    <p>
      Zero-knowledge backing and identity checks for a collateralized card,
      on Midnight. Two proofs, one primitive: verify a signed attestation,
      evaluate a predicate, disclose only the outcome.
    </p>
    <div class="status" id="pwa-status">checking install support&hellip;</div>
  `;
}

function applyStatus(status: PwaStatus) {
  const statusEl = document.querySelector<HTMLDivElement>('#pwa-status');
  if (!statusEl) return;

  if (status.state) statusEl.dataset.state = status.state;
  else delete statusEl.dataset.state;
  statusEl.textContent = status.message;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    applyStatus(unsupportedStatus());
    return;
  }

  try {
    await navigator.serviceWorker.register('/sw.js');
    applyStatus(readyStatus());
  } catch {
    applyStatus(failedStatus());
  }
}

registerServiceWorker();
