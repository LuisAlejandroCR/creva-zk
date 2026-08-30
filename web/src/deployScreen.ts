// deployScreen.ts
// The operator deployments' screen, string-in/string-out like the rest of
// the view layer so its copy can be asserted under plain vitest. It is not
// one of the journey's screens and does not pretend to be: it carries no
// step indicator, it says on every state that it is a one-off operator tool
// on a test network that spends tDUST, and its finished state is the values
// a build needs plus what to do with them.

import type { ApiFailureReason } from '@creva-zk/api';
import type { DeployState, DeployTarget } from './deployRun';
import { renderStatusState, renderTopbar, type StatusTone } from './ui';

/** The hooks deployMount.ts attaches to. */
export const DEPLOY_CTA_ROLE = 'deploy-cta';
export const DEPLOY_ADDRESS_ROLE = 'deploy-address';
export const DEPLOY_COPY_ROLE = 'deploy-copy';
/** The identity deployment's second value, and the button beside it. */
export const DEPLOY_ISSUER_KEY_ROLE = 'deploy-issuer-key';
export const DEPLOY_COPY_ISSUER_KEY_ROLE = 'deploy-copy-issuer-key';

// Said on every state, never only on the last one: whoever opens this screen
// is spending real test funds from their own wallet on a network that is not
// production, and neither half of that may be a surprise.
const OPERATOR_BANNER =
  'Herramienta de operador, no parte del producto. Despliega un contrato nuevo en la red de prueba de Midnight (preprod) y lo paga con tDUST de tu cartera. La usuaria nunca ve esta pantalla.';

const IDLE_TITLE = 'Desplegar un contrato';
const IDLE_BODY =
  'Hay dos, y son independientes: el de respaldo y el de identidad. Cada uno se despliega una sola vez, cada uno cuesta tDUST de tu cartera, y al pulsar cualquiera de los dos Lace te pedirá firmar la transacción: son las únicas veces que esta app pide una firma que no es una prueba de la usuaria.';
const BACKING_CTA = 'Desplegar respaldo una vez';
const IDENTITY_CTA = 'Desplegar identidad una vez';

const RUNNING_TITLE: Readonly<Record<DeployTarget, string>> = {
  backing: 'Desplegando el contrato de respaldo…',
  identity: 'Desplegando el contrato de identidad…',
};
const RUNNING_BODY =
  'Se está construyendo la transacción, probándola en tu servidor local, firmándola en Lace y esperando a que la red la confirme. Puede tardar varios minutos. No cierres esta pantalla.';

const DONE_TITLE: Readonly<Record<DeployTarget, string>> = {
  backing: 'Contrato de respaldo desplegado',
  identity: 'Contrato de identidad desplegado',
};
// The whole point of the screen: the values, and what to do with them.
const DONE_BODY: Readonly<Record<DeployTarget, string>> = {
  backing: 'Copia esta dirección, ponla en VITE_BACKING_CONTRACT_ADDRESS y vuelve a construir la app:',
  identity:
    'Copia estos DOS valores y vuelve a construir la app. Hacen falta los dos: sin la llave del emisor el circuito aborta la verificación de firma y la pantalla dice que todavía no se puede sobre una identidad que sí era válida.',
};
const DONE_STEPS: Readonly<Record<DeployTarget, string>> = {
  backing: 'VITE_PORT_SOURCE=lace VITE_BACKING_CONTRACT_ADDRESS=&lt;la dirección de arriba&gt; npm run build --workspace web',
  identity:
    'VITE_PORT_SOURCE=lace VITE_IDENTITY_CONTRACT_ADDRESS=&lt;la dirección&gt; VITE_IDENTITY_ISSUER_KEY=&lt;la llave x:y&gt; npm run build --workspace web',
};
const DONE_NOTE =
  'No vuelvas a desplegar: cada despliegue crea otro contrato y cuesta tDUST otra vez. Guarda estos valores antes de cerrar la pestaña.';
// Only the identity deployment leaves something behind in this browser.
const IDENTITY_NOTE =
  'El attestation que firma este despliegue queda guardado como estado privado en ESTE navegador y con ESTA cartera, y es lo que lee la prueba después: corre el recorrido desde aquí mismo. Todos los datos del attestation son sintéticos y no pertenecen a ninguna persona.';
const COPY_ADDRESS_LABEL = 'Copiar dirección';
const COPY_ISSUER_KEY_LABEL = 'Copiar llave del emisor';
const ISSUER_KEY_LABEL = 'Llave del emisor (x:y, en decimal)';

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

/** One button: which deployment it starts, and what it says. */
export interface DeployAction {
  readonly target: DeployTarget;
  readonly label: string;
}

export interface DeployScreenContent {
  readonly title: string;
  readonly tone: StatusTone;
  readonly body: string;
  readonly target: DeployTarget;
  readonly address?: string;
  /** Decimal "x:y". Only a finished identity deployment has one. */
  readonly issuerKey?: string;
  readonly actions: readonly DeployAction[];
}

// The four states, and nothing between them.
export function buildDeployContent(state: DeployState): DeployScreenContent {
  const target = state.target;
  if (state.phase === 'running') {
    return { title: RUNNING_TITLE[target], tone: 'processing', body: RUNNING_BODY, target, actions: [] };
  }
  if (state.phase === 'done') {
    return {
      title: DONE_TITLE[target],
      tone: 'success',
      body: DONE_BODY[target],
      target,
      ...(state.address === undefined ? {} : { address: state.address }),
      ...(state.issuerKey === undefined ? {} : { issuerKey: state.issuerKey }),
      actions: [],
    };
  }
  if (state.phase === 'degraded') {
    const reason = state.reason;
    return {
      title: DEGRADED_TITLE,
      tone: 'error',
      body: (reason === undefined ? undefined : DEGRADED_COPY[reason]) ?? DEGRADED_FALLBACK,
      target,
      // Retries the deployment that failed, never the other one: the operator
      // pressed a specific button and a retry that moved to the other target
      // would spend tDUST on a contract nobody asked for.
      actions: [{ target, label: DEGRADED_CTA }],
    };
  }
  return {
    title: IDLE_TITLE,
    tone: 'warning',
    body: IDLE_BODY,
    target,
    actions: [
      { target: 'backing', label: BACKING_CTA },
      { target: 'identity', label: IDENTITY_CTA },
    ],
  };
}

// The values are hex and decimal strings off the chain rather than anything a
// person typed, but they are still put on the page as text and so are still
// escaped: a view layer that trusts one input is a view layer that trusts the
// next.
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
function renderCopyableValue(role: string, copyRole: string, label: string, copyLabel: string, value: string): string {
  return `
    <p class="lede">
      <input class="deploy-address" data-role="${role}" type="text" readonly
             value="${escapeHtml(value)}" aria-label="${label}" size="68" />
    </p>
    <p><button class="btn-secondary" type="button" data-role="${copyRole}">${copyLabel}</button></p>
  `;
}

function renderValues(content: DeployScreenContent): string {
  if (content.address === undefined) return '';
  const address = renderCopyableValue(
    DEPLOY_ADDRESS_ROLE,
    DEPLOY_COPY_ROLE,
    'Dirección del contrato desplegado',
    COPY_ADDRESS_LABEL,
    content.address,
  );
  const issuerKey =
    content.issuerKey === undefined
      ? ''
      : renderCopyableValue(
          DEPLOY_ISSUER_KEY_ROLE,
          DEPLOY_COPY_ISSUER_KEY_ROLE,
          ISSUER_KEY_LABEL,
          COPY_ISSUER_KEY_LABEL,
          content.issuerKey,
        );
  const extra = content.target === 'identity' ? `<p class="disclaimer">${IDENTITY_NOTE}</p>` : '';
  return `${address}${issuerKey}
    <p class="disclaimer"><code>${DONE_STEPS[content.target]}</code></p>
    <p class="disclaimer">${DONE_NOTE}</p>${extra}`;
}

export function renderDeployScreen(content: DeployScreenContent): string {
  const blocks = [
    `<header class="screen-header"><div class="screen-title-row"><h1 data-role="screen-title">${content.title}</h1></div>
       <p class="disclaimer" data-role="deploy-banner">${OPERATOR_BANNER}</p></header>`,
    renderStatusState({ tone: content.tone, body: content.body }),
    renderValues(content),
    content.actions
      .map(
        (action) =>
          `<button class="btn-primary" type="button" data-role="${DEPLOY_CTA_ROLE}" data-target="${action.target}">${action.label}</button>`,
      )
      .join(''),
  ].join('');

  // No step indicator and no ? : this screen is not a step of the journey
  // and has no help article, because nobody but an operator reaches it.
  return `${renderTopbar()}<div class="screen-body" data-archetype="recover" data-phase="deploy">${blocks}</div>`;
}
