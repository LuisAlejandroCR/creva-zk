// helpRoute.ts
// Parses a location hash into a help route, mirroring creva_finance's
// /help, /help/[category] and /help/[category]/[article] segments. Pure and
// string-in/string-out, so routing is testable without a browser.

export type HelpRoute =
  | { readonly kind: 'journey' }
  | { readonly kind: 'index' }
  | { readonly kind: 'category'; readonly category: string }
  | { readonly kind: 'article'; readonly category: string; readonly article: string };

export const HELP_ROOT = '#/ayuda';

export function helpIndexHref(): string {
  return HELP_ROOT;
}

export function helpCategoryHref(categorySlug: string): string {
  return `${HELP_ROOT}/${categorySlug}`;
}

export function helpArticleHref(path: string): string {
  return `${HELP_ROOT}/${path}`;
}

// Anything that is not a help route is the journey. An unknown or malformed
// help path resolves to the index rather than to a dead end: a ? that lands
// on nothing is the one outcome this router must never produce.
export function parseHelpRoute(hash: string): HelpRoute {
  const trimmed = hash.replace(/^#/, '').replace(/\/+$/, '');
  const segments = trimmed.split('/').filter(Boolean);

  if (segments[0] !== 'ayuda') return { kind: 'journey' };
  if (segments.length === 1) return { kind: 'index' };
  if (segments.length === 2) return { kind: 'category', category: segments[1]! };
  if (segments.length === 3) {
    return { kind: 'article', category: segments[1]!, article: segments[2]! };
  }
  return { kind: 'index' };
}
