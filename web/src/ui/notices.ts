// ui/notices.ts
// SecurityNotice, HelpButton and SystemStatus: the three things that used to
// be full-width cards on every screen. The trust message is a line under the
// work it belongs to; the other two are icons in the navigation strip that
// name themselves on hover, tap or focus — persistent, reachable, and out of
// the way of the one thing the screen is asking her to do.

import { helpArticleHref } from '../help/helpRoute';
import { readPwaStatus } from '../pwa-status';

export interface SecurityNoticeOptions {
  /** One sentence. The detail lives behind "Más información". */
  readonly message: string;
  /** "category/article" the "Más información" link opens. */
  readonly help: string;
}

// The trust message is worth keeping and was never worth a card: it says
// enough to establish trust here, and the technical explanation is one tap
// away for anyone who wants it.
export function renderSecurityNotice(options: SecurityNoticeOptions): string {
  return `
    <p class="security-notice">
      <span class="security-notice-mark" aria-hidden="true">🔒</span>
      <span class="security-notice-copy">${options.message}
        <a class="security-notice-more" href="${helpArticleHref(options.help)}">Más información</a>
      </span>
    </p>
  `;
}

/**
 * icon — the persistent ? in the navigation strip, on every screen.
 * secondary — a real second action, for a state whose whole question is why
 *             it happened.
 */
export type HelpTone = 'icon' | 'secondary';

export const HELP_LABEL = 'Ayuda';
export const HELP_LABEL_WHY = '¿Por qué ocurrió?';

// The label is real text rather than an aria-label, so it is the link's
// accessible name and appears on hover, on tap and on keyboard focus alike.
// A tooltip nobody can reach on a phone would be no label at all.
export function renderHelpButton(help: string): string {
  return `
    <a class="icon-button" href="${helpArticleHref(help)}" data-role="help-link">
      <span class="icon-button-glyph" aria-hidden="true">?</span>
      <span class="icon-button-tip">${HELP_LABEL}</span>
    </a>
  `;
}

// The one screen state whose whole question is "why did that happen" gets a
// real second action for it, rather than sending her to the same ? as every
// other screen and hoping she finds it.
export function renderHelpWhy(help: string): string {
  return `<a class="btn-secondary" href="${helpArticleHref(help)}" data-role="help-why">${HELP_LABEL_WHY}</a>`;
}

// Drawn rather than set as emoji, so it takes its weight from the ? beside
// it and its colour from the theme.
const LOCK_GLYPH = `<svg class="icon-glyph-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /><rect x="5" y="10" width="14" height="9.5" rx="2.5" /></svg>`;

// Installable/offline state: a lock beside the ?, quiet by default and
// naming itself the same three ways. It is about the app, not about her
// application, so it never takes a line of its own again.
export function renderSystemStatus(): string {
  const status = readPwaStatus();
  const state = status.state ? ` data-state="${status.state}"` : '';
  return `
    <button class="icon-button" type="button" id="pwa-status"${state}>
      <span class="icon-button-glyph" aria-hidden="true">${LOCK_GLYPH}</span>
      <span class="icon-button-tip" data-role="system-status-text" aria-live="polite">${status.message}</span>
    </button>
  `;
}
