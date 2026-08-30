// deployScreen.ts
// The operator deployment's screen, string-in/string-out like the rest of
// the view layer so its copy can be asserted under plain vitest. It is not
// one of the journey's screens and does not pretend to be: it carries no
// step indicator, it says on every state that it is a one-off operator tool
// on a test network, and its finished state is one address plus what to do
// with it.

import type { ApiFailureReason } from '@creva-zk/api';
import type { DeployState } from './deployRun';
import { renderStatusState, renderTopbar, type StatusTone } from './ui';

/** The hooks deployMount.ts attaches to. */
export const DEPLOY_CTA_ROLE = 'deploy-cta';
export const DEPLOY_ADDRESS_ROLE = 'deploy-address';
export const DEPLOY_COPY_ROLE = 'deploy-copy';

// Said on every state, never only on the last one: whoever opens this screen
// is spending real test funds from their own wallet on a network that is not
// production, and neither half of that may be a surprise.
const OPERATOR_BANNER =
  'Herramienta de operador, no parte del producto. Despliega un contrato nuevo en la red de prueba de Midnight (preprod) y lo paga con tDUST de tu cartera. La usuaria nunca ve esta pantalla.';

const IDLE_TITLE = 'Desplegar el contrato de respaldo';
const IDLE_BODY =
  'Se despliega una sola vez. Al pulsar, Lace te pedirá firmar la transacción: es la única vez que esta app pide una firma que no es una prueba de la usuaria.';
const IDLE_CTA = 'Desplegar una vez';

const RUNNING_TITLE = 'Desplegando…';
const RUNNING_BODY =
  'Se está construyendo la transacción, probándola en tu servidor local, firmándola en Lace y esperando a que la red la confirme. Puede tardar varios minutos. No cierres esta pantalla.';

const DONE_TITLE = 'Contrato desplegado';
// The whole point of the screen: an address, and what to do with it.
const DONE_BODY = 'Copia esta dirección, ponla en VITE_BACKING_CONTRACT_ADDRESS y vuelve a construir la app:';
const DONE_STEPS =
  'VITE_PORT_SOURCE=lace VITE_BACKING_CONTRACT_ADDRESS=&lt;la dirección de arriba&gt; npm run build --workspace web';
const DONE_NOTE =
  'No vuelvas a desplegar: cada despliegue crea otro contrato y cuesta tDUST otra vez. Guarda esta dirección antes de cerrar la pestaña.';
const COPY_LABEL = 'Copiar dirección';

const DEGRADED_TITLE = 'No se desplegó nada';
const DEGRADED_CTA = 'Reintentar';

// One line per reason, each naming the single thing the operator has to fix.
// Every reason here already existed on the browser-direct path — none was
// invented for this screen.
const DEGRADED_COPY: Partial<Readonly<Record<ApiFailureReason, string>>> = {
  wallet_absent: 'Este navegador no tiene ninguna cartera de Midnight instalada. Instala Lace en su versión Midnight Preview.',
  wallet_locked: 'Lace está instalada pero no entregó una conexión. Ábrela, desbloquéala y autoriza este sitio.',
  wallet_wrong_network: 'Lace está conectada a otra red. Cámbiala a la red de prueba de Midnight (preprod).',
  proof_server_unreachable:
    'No respondió el servidor de pruebas que configuraste en Lace (Ajustes » Midnight » Local, http://localhost:6300). Inícialo.',
  deploy_failed:
    'La red no confirmó el despliegue: pudo faltar tDUST, pudo rechazarse la firma, o pudo agotarse el tiempo de espera. Si se agotó el tiempo, revisa si el contrato llegó a desplegarse antes de pagar otro.',
  contract_not_compiled:
    'Falta el circuito compilado en esta build. Ejecuta npm run compact:build y vuelve a construir la app.',
  environment_unavailable:
    'Esta build no es la del camino directo con Lace. Reconstruye con VITE_PORT_SOURCE=lace.',
};

const DEGRADED_FALLBACK = 'El despliegue no llegó a completarse y nadie pudo decir por qué.';

export interface DeployScreenContent {
  readonly title: string;
  readonly tone: StatusTone;
  readonly body: string;
  readonly address?: string;
  readonly ctaLabel?: string;
}

// The four states, and nothing between them.
export function buildDeployContent(state: DeployState): DeployScreenContent {
  if (state.phase === 'running') {
    return { title: RUNNING_TITLE, tone: 'processing', body: RUNNING_BODY };
  }
  if (state.phase === 'done') {
    return { title: DONE_TITLE, tone: 'success', body: DONE_BODY, address: state.address };
  }
  if (state.phase === 'degraded') {
    const reason = state.reason;
    return {
      title: DEGRADED_TITLE,
      tone: 'error',
      body: (reason === undefined ? undefined : DEGRADED_COPY[reason]) ?? DEGRADED_FALLBACK,
      ctaLabel: DEGRADED_CTA,
    };
  }
  return { title: IDLE_TITLE, tone: 'warning', body: IDLE_BODY, ctaLabel: IDLE_CTA };
}

// The address is a hex string off the chain rather than anything a person
// typed, but it is still put on the page as text and so is still escaped:
// a view layer that trusts one input is a view layer that trusts the next.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Readonly rather than a bare <code>: an input can be tapped, selected whole
// and copied on a phone, which is what "copiable" has to mean here. The
// button beside it is the one-tap version for a browser that allows it.
function renderAddress(address: string): string {
  const safe = escapeHtml(address);
  return `
    <p class="lede">
      <input class="deploy-address" data-role="${DEPLOY_ADDRESS_ROLE}" type="text" readonly
             value="${safe}" aria-label="Dirección del contrato desplegado" size="68" />
    </p>
    <p><button class="btn-secondary" type="button" data-role="${DEPLOY_COPY_ROLE}">${COPY_LABEL}</button></p>
    <p class="disclaimer"><code>${DONE_STEPS}</code></p>
    <p class="disclaimer">${DONE_NOTE}</p>
  `;
}

export function renderDeployScreen(content: DeployScreenContent): string {
  const blocks = [
    `<header class="screen-header"><div class="screen-title-row"><h1 data-role="screen-title">${content.title}</h1></div>
       <p class="disclaimer" data-role="deploy-banner">${OPERATOR_BANNER}</p></header>`,
    renderStatusState({ tone: content.tone, body: content.body }),
    content.address === undefined ? '' : renderAddress(content.address),
    content.ctaLabel === undefined
      ? ''
      : `<button class="btn-primary" type="button" data-role="${DEPLOY_CTA_ROLE}">${content.ctaLabel}</button>`,
  ].join('');

  // No step indicator and no ? : this screen is not a step of the journey
  // and has no help article, because nobody but an operator reaches it.
  return `${renderTopbar()}<div class="screen-body" data-archetype="recover" data-phase="deploy">${blocks}</div>`;
}
