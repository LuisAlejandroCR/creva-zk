// deployMount.ts
// The DOM half of the operator deployment: renders the screen, wires the one
// button that starts a deployment and the one that copies the address, and
// nothing else. Mounting renders the idle screen — it never deploys. The
// deployment happens when the operator presses the button, and only then.

import { createDeployController, type DeployState } from './deployRun';
import { buildDeployContent, renderDeployScreen, DEPLOY_ADDRESS_ROLE, DEPLOY_COPY_ROLE, DEPLOY_CTA_ROLE } from './deployScreen';
import { runLaceDeployment } from './laceDeploy';
import { laceDeployOptions } from './deployOptions';

export function mountDeployTool(root: HTMLElement): void {
  const controller = createDeployController({
    deploy: () => runLaceDeployment(laceDeployOptions()),
    emit: (state) => render(state),
  });

  function render(state: DeployState): void {
    root.innerHTML = renderDeployScreen(buildDeployContent(state));

    root
      .querySelector<HTMLButtonElement>(`[data-role="${DEPLOY_CTA_ROLE}"]`)
      // Floating on purpose: run() settles by emitting, which re-renders.
      ?.addEventListener('click', () => void controller.run());

    const address = root.querySelector<HTMLInputElement>(`[data-role="${DEPLOY_ADDRESS_ROLE}"]`);
    root.querySelector<HTMLButtonElement>(`[data-role="${DEPLOY_COPY_ROLE}"]`)?.addEventListener('click', () => {
      if (address === null) return;
      // Selecting is the fallback that always works: a browser without
      // clipboard permission still leaves the address selected to copy by
      // hand, which is the whole reason this screen exists.
      address.select();
      void navigator.clipboard?.writeText(address.value).catch(() => undefined);
    });
  }

  // The idle screen, with nothing in flight and nothing signed.
  render(controller.state());
}
