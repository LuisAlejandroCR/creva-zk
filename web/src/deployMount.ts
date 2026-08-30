// deployMount.ts
// The DOM half of the operator deployments: renders the screen, wires the
// buttons that start a deployment and the ones that copy a value, and nothing
// else. Mounting renders the idle screen — it never deploys. A deployment
// happens when the operator presses one of the buttons, and only then.

import { createDeployController, type DeployState, type DeployTarget } from './deployRun';
import {
  buildDeployContent,
  renderDeployScreen,
  DEPLOY_ADDRESS_ROLE,
  DEPLOY_COPY_ISSUER_KEY_ROLE,
  DEPLOY_COPY_ROLE,
  DEPLOY_CTA_ROLE,
  DEPLOY_ISSUER_KEY_ROLE,
} from './deployScreen';
import { runLaceDeployment, runLaceIdentityDeployment } from './laceDeploy';
import { laceDeployOptions, laceIdentityDeployOptions } from './deployOptions';

export function mountDeployTool(root: HTMLElement): void {
  const controller = createDeployController({
    deploy: (target) =>
      target === 'identity'
        ? runLaceIdentityDeployment(laceIdentityDeployOptions())
        : runLaceDeployment(laceDeployOptions()),
    emit: (state) => render(state),
  });

  // Selecting is the fallback that always works: a browser without clipboard
  // permission still leaves the value selected to copy by hand, which is the
  // whole reason this screen exists.
  function wireCopy(valueRole: string, buttonRole: string): void {
    const field = root.querySelector<HTMLInputElement>(`[data-role="${valueRole}"]`);
    root.querySelector<HTMLButtonElement>(`[data-role="${buttonRole}"]`)?.addEventListener('click', () => {
      if (field === null) return;
      field.select();
      void navigator.clipboard?.writeText(field.value).catch(() => undefined);
    });
  }

  function render(state: DeployState): void {
    root.innerHTML = renderDeployScreen(buildDeployContent(state));

    for (const button of root.querySelectorAll<HTMLButtonElement>(`[data-role="${DEPLOY_CTA_ROLE}"]`)) {
      const target = (button.dataset.target === 'identity' ? 'identity' : 'backing') satisfies DeployTarget;
      // Floating on purpose: run() settles by emitting, which re-renders.
      button.addEventListener('click', () => void controller.run(target));
    }

    wireCopy(DEPLOY_ADDRESS_ROLE, DEPLOY_COPY_ROLE);
    wireCopy(DEPLOY_ISSUER_KEY_ROLE, DEPLOY_COPY_ISSUER_KEY_ROLE);
  }

  // The idle screen, with nothing in flight and nothing signed.
  render(controller.state());
}
