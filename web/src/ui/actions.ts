// ui/actions.ts
// PrimaryAction: one per screen, always the strongest element after the
// headline. The only secondary action the flow has is `recover`'s
// "¿Por qué ocurrió?", which is a link into the help centre and so lives in
// notices.ts beside the ? it belongs with — it wears .btn-secondary, the
// text-action treatment that never competes with the primary.

export interface ActionOptions {
  readonly label: string;
  readonly disabled?: boolean;
}

export function renderPrimaryAction(options: ActionOptions): string {
  return `<button class="btn-primary" data-role="cta"${options.disabled ? ' disabled' : ''}>${options.label}</button>`;
}
