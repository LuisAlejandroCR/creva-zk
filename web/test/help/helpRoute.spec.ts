// helpRoute.spec.ts
// The hash router that stands in for creva_finance's /help, /help/[category]
// and /help/[category]/[article] segments. A malformed help path resolves to
// the index rather than to a dead end.

import { describe, expect, it } from 'vitest';
import {
  helpArticleHref,
  helpCategoryHref,
  helpIndexHref,
  parseHelpRoute,
} from '../../src/help/helpRoute';

describe('parseHelpRoute', () => {
  it('treats everything that is not help as the journey', () => {
    expect(parseHelpRoute('').kind).toBe('journey');
    expect(parseHelpRoute('#').kind).toBe('journey');
    expect(parseHelpRoute('#/otra-cosa').kind).toBe('journey');
  });

  it('reads the three help shapes', () => {
    expect(parseHelpRoute('#/ayuda')).toEqual({ kind: 'index' });
    expect(parseHelpRoute('#/ayuda/privacidad')).toEqual({ kind: 'category', category: 'privacidad' });
    expect(parseHelpRoute('#/ayuda/privacidad/que-ve-creva')).toEqual({
      kind: 'article',
      category: 'privacidad',
      article: 'que-ve-creva',
    });
  });

  it('tolerates trailing slashes rather than dead-ending on one', () => {
    expect(parseHelpRoute('#/ayuda/').kind).toBe('index');
    expect(parseHelpRoute('#/ayuda/privacidad/').kind).toBe('category');
  });

  it('sends anything deeper back to the index', () => {
    expect(parseHelpRoute('#/ayuda/a/b/c/d').kind).toBe('index');
  });

  it('builds the hrefs the ? and the cards use', () => {
    expect(helpIndexHref()).toBe('#/ayuda');
    expect(helpCategoryHref('privacidad')).toBe('#/ayuda/privacidad');
    expect(helpArticleHref('privacidad/que-ve-creva')).toBe('#/ayuda/privacidad/que-ve-creva');
  });

  it('round-trips every href it builds', () => {
    expect(parseHelpRoute(helpCategoryHref('resultado'))).toEqual({
      kind: 'category',
      category: 'resultado',
    });
    expect(parseHelpRoute(helpArticleHref('resultado/que-es-un-nivel'))).toEqual({
      kind: 'article',
      category: 'resultado',
      article: 'que-es-un-nivel',
    });
  });
});
