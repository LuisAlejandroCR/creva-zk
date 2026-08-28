// main.ts
// Web workspace entry point: renders the app shell and screen journey, and
// registers the offline service worker, reporting install status in the UI.

import { failedStatus, readyStatus, unsupportedStatus, type PwaStatus } from './pwa-status';
import { mountApp } from './app';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <header class="brand">
      <img class="mark" src="/icons/icon-192.png" alt="" width="32" height="32" />
      <span>Creva ZK</span>
    </header>
    <main class="screen" id="screen-root"></main>
    <div class="status" id="pwa-status">comprobando compatibilidad de instalación&hellip;</div>
  `;

  const screenRoot = document.querySelector<HTMLElement>('#screen-root');
  if (screenRoot) mountApp(screenRoot);
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
