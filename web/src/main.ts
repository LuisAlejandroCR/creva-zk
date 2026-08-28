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

async function registerServiceWorker() {
  const statusEl = document.querySelector<HTMLDivElement>('#pwa-status');
  if (!statusEl) return;

  if (!('serviceWorker' in navigator)) {
    statusEl.textContent = 'offline support not available in this browser';
    return;
  }

  try {
    await navigator.serviceWorker.register('/sw.js');
    statusEl.dataset.state = 'ready';
    statusEl.textContent = 'installable — works offline';
  } catch {
    statusEl.textContent = 'offline support failed to register';
  }
}

registerServiceWorker();
