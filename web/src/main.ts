// main.ts
// Web workspace entry point: mounts the screen journey and registers the
// offline service worker, reporting install status in the UI.
//
// The brand, the ?, the install state and the step indicator all live inside
// the screen itself, in the frame OnboardingShell renders, so a screen owns
// everything around its own headline. What stays out here is the service
// worker registration and the status it reports.

// First import in the app, deliberately: it installs the Buffer global the
// Midnight SDK needs before any module that might reach for it loads.
import './nodeGlobals';

import { failedStatus, readyStatus, setPwaStatus, unsupportedStatus, type PwaStatus } from './pwa-status';
import { renderProgressMomentHost } from './ui';
import { mountApp } from './app';
import { isDeployToolRequested } from './deployTool';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  // The moment host sits outside the screen and stays there: the navigation
  // strip it hangs from is rebuilt on every render, and a popover living
  // inside it would be torn off mid-life.
  app.innerHTML = `<main class="screen" id="screen-root"></main>${renderProgressMomentHost()}`;

  const screenRoot = document.querySelector<HTMLElement>('#screen-root');
  // The one fork in this file, and it is off unless an operator asked for it
  // by build flag or by URL parameter. Without either, this is the same call
  // it has always been and the deployment tool is not on the page at all —
  // and even with it, mounting the tool deploys nothing by itself.
  if (screenRoot) {
    if (isDeployToolRequested(import.meta.env, window.location.search)) {
      // Loaded only here, so an ordinary build carries none of the operator
      // tool at all — not its screen, not its adapter, nothing. A chunk that
      // fails to load leaves the page empty rather than silently falling
      // back to the journey, because an operator who asked to deploy must
      // never be handed something else instead.
      void import('./deployMount')
        .then((module) => module.mountDeployTool(screenRoot))
        .catch((error: unknown) => console.error('[creva-zk] the deployment tool failed to load', error));
    } else {
      mountApp(screenRoot);
    }
  }
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
