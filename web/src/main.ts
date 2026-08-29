// main.ts
// Web workspace entry point: mounts the screen journey and registers the
// offline service worker, reporting install status in the UI.
//
// The brand, the ?, the install state and the step indicator all live inside
// the screen itself, in the frame OnboardingShell renders, so a screen owns
// everything around its own headline. What stays out here is the service
// worker registration and the status it reports.

import { failedStatus, readyStatus, setPwaStatus, unsupportedStatus, type PwaStatus } from './pwa-status';
import { renderProgressMomentHost } from './ui';
import { mountApp } from './app';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  // The moment host sits outside the screen and stays there: the navigation
  // strip it hangs from is rebuilt on every render, and a popover living
  // inside it would be torn off mid-life.
  app.innerHTML = `<main class="screen" id="screen-root"></main>${renderProgressMomentHost()}`;

  const screenRoot = document.querySelector<HTMLElement>('#screen-root');
  if (screenRoot) mountApp(screenRoot);
}

// The lock lives in the navigation strip, which every render rebuilds, so
// the status is recorded first — that is what the next strip is drawn from —
// and only then patched into the one on screen, so a change she is looking
// at does not wait for a re-render to appear.
function applyStatus(status: PwaStatus) {
  setPwaStatus(status);

  const statusEl = document.querySelector<HTMLElement>('#pwa-status');
  if (!statusEl) return;

  if (status.state) statusEl.dataset.state = status.state;
  else delete statusEl.dataset.state;

  const text = statusEl.querySelector<HTMLElement>('[data-role="system-status-text"]');
  if (text) text.textContent = status.message;
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
