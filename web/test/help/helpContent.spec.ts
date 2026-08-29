// helpContent.spec.ts
// The help centre's own guard rails, mirroring creva_finance's
// test/lib/help-content.test.ts: a ? that leads nowhere fails the build, and
// no article ever states a threshold, a ratio or a tier boundary.

import { describe, expect, it } from 'vitest';
import {
  HELP_CATEGORIES,
  everyHelpArticle,
  findArticle,
  helpPathExists,
} from '../../src/help/helpContent';
import { buildIdentityContent } from '../../src/screens/identityContent';
import { buildBackingContent } from '../../src/screens/backingContent';
import { buildCompareContent } from '../../src/screens/compareContent';
import { buildOffersContent } from '../../src/screens/offersContent';
import { renderHelpArticle, renderHelpCategory, renderHelpIndex } from '../../src/help/helpRender';
import { parseHelpRoute } from '../../src/help/helpRoute';
import {
  idleProof,
  settleDegraded,
  settleFailed,
  settleReady,
} from '../../src/domain/proofState';
import type { Tier } from '../../src/domain/tier';

const ARTICLES = everyHelpArticle();

describe('the help centre is well formed', () => {
  it('ships categories, each with articles', () => {
    expect(HELP_CATEGORIES.length).toBeGreaterThanOrEqual(3);
    for (const category of HELP_CATEGORIES) {
      expect(category.articles.length, `${category.slug} has no articles`).toBeGreaterThan(0);
      expect(category.title).toBeTruthy();
      expect(category.lead).toBeTruthy();
      expect(category.icon).toBeTruthy();
    }
  });

  it('keeps every slug unique, so no two articles fight over one address', () => {
    const categorySlugs = HELP_CATEGORIES.map((category) => category.slug);
    expect(new Set(categorySlugs).size).toBe(categorySlugs.length);

    for (const category of HELP_CATEGORIES) {
      const slugs = category.articles.map((article) => article.slug);
      expect(new Set(slugs).size, `${category.slug} repeats an article slug`).toBe(slugs.length);
    }
  });

  it('uses url-safe slugs only', () => {
    for (const { category, article } of ARTICLES) {
      expect(category.slug).toMatch(/^[a-z0-9-]+$/);
      expect(article.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('every article is written as a question she would ask', () => {
  it.each(ARTICLES.map((entry) => [`${entry.category.slug}/${entry.article.slug}`, entry] as const))(
    '%s asks a real question and answers it in one line',
    (_path, { article }) => {
      expect(article.question.length).toBeGreaterThan(8);
      // Phrased from her side: either a question she asks, or the symptom
      // she would report. Never a feature name dressed up as a heading.
      expect(article.question, 'a heading, not something she would say').toMatch(
        /[?¿]|^(dice|me pide|mi |no me|no puedo|se me)/i,
      );

      // One line: what she reads before deciding to open anything.
      expect(article.answer).toBeTruthy();
      expect(article.answer).not.toContain('\n');
      expect(article.answer.length).toBeLessThanOrEqual(140);
    },
  );

  it.each(ARTICLES.map((entry) => [`${entry.category.slug}/${entry.article.slug}`, entry] as const))(
    '%s carries no markup — the content module stays plain text',
    (_path, { article }) => {
      const everyString = [
        article.question,
        article.answer,
        article.note ?? '',
        article.resolvedBy ?? '',
        ...(article.steps ?? []),
        ...(article.keywords ?? []),
      ].join(' ');
      expect(everyString).not.toMatch(/<[a-z/!]/i);
      expect(everyString).not.toMatch(/&[a-z]+;/i);
    },
  );

  // Keywords are what she would type into a search box. "prueba de
  // conocimiento cero" is what we called it; "no quiero que vean mi saldo"
  // is what she would type.
  it('gives most articles the words she would actually type', () => {
    const withKeywords = ARTICLES.filter((entry) => (entry.article.keywords?.length ?? 0) > 0);
    expect(withKeywords.length).toBe(ARTICLES.length);
    for (const { article } of ARTICLES) {
      for (const keyword of article.keywords ?? []) {
        expect(keyword).toBe(keyword.toLowerCase());
      }
    }
  });
});

// Criterion 3, and the same rule creva_finance's own test enforces:
// publishing where a tier begins gives away Creva's business logic.
describe('no article ever states a threshold, a ratio or a tier boundary', () => {
  const TIERS = /(bronce|plata|oro)/i;
  const FORMULA_WORDS = /\b(umbral(es)?|ratio|proporci[oó]n|f[oó]rmula|porcentaje|m[uú]ltiplo|equivale a)\b/i;
  const COMPARATOR = /[<>≥≤]|%|\bmxn\b|\$\s?\d/i;

  it.each(ARTICLES.map((entry) => [`${entry.category.slug}/${entry.article.slug}`, entry] as const))(
    '%s publishes no number that would reveal the rule',
    (path, { article }) => {
      const sentences = [
        article.answer,
        article.note ?? '',
        article.resolvedBy ?? '',
        ...(article.steps ?? []),
      ].flatMap((block) => block.split(/(?<=[.?!])\s+/));

      for (const sentence of sentences) {
        expect(sentence, `${path} names a comparison: ${sentence}`).not.toMatch(COMPARATOR);
        expect(sentence, `${path} names a formula: ${sentence}`).not.toMatch(FORMULA_WORDS);
        // A tier and a figure in the same breath is a published boundary.
        const namesTier = TIERS.test(sentence);
        const namesFigure = /\d/.test(sentence);
        expect(
          namesTier && namesFigure,
          `${path} puts a tier and a figure in one sentence: ${sentence}`,
        ).toBe(false);
      }
    },
  );
});

describe('a ? that leads nowhere fails the build', () => {
  const SCREEN_HELP: ReadonlyArray<readonly [string, string]> = [
    ['identity/idle', buildIdentityContent(idleProof<boolean>(), 0).help],
    ['identity/ready', buildIdentityContent(settleReady(true), 0).help],
    ['identity/failed', buildIdentityContent(settleFailed<boolean>(), 0).help],
    ['backing/idle', buildBackingContent(idleProof<Tier>(), 0).help],
    ['backing/ready', buildBackingContent(settleReady<Tier>('silver'), 0).help],
    ['backing/failed', buildBackingContent(settleFailed<Tier>(), 0).help],
    ['compare', buildCompareContent().help],
    ['offers', buildOffersContent('silver').help],
    // Every degraded reason the browser-direct path can name.
    ['identity/call_failed', buildIdentityContent(settleDegraded<boolean>('call_failed'), 0).help],
    ['identity/wallet_absent', buildIdentityContent(settleDegraded<boolean>('wallet_absent'), 0).help],
    ['identity/wallet_locked', buildIdentityContent(settleDegraded<boolean>('wallet_locked'), 0).help],
    ['backing/wallet_wrong_network', buildBackingContent(settleDegraded<Tier>('wallet_wrong_network'), 0).help],
    ['backing/proof_server_unreachable', buildBackingContent(settleDegraded<Tier>('proof_server_unreachable'), 0).help],
    ['backing/call_failed', buildBackingContent(settleDegraded<Tier>('call_failed'), 0).help],
  ];

  it.each(SCREEN_HELP)('the ? on %s lands on an article that exists', (_screen, path) => {
    expect(path, 'a screen with no help path').toBeTruthy();
    expect(helpPathExists(path), `nothing lives at ${path}`).toBe(true);
  });

  it('sends a degraded reason to the article about that reason', () => {
    expect(buildIdentityContent(settleDegraded<boolean>('wallet_absent'), 0).help).toBe(
      'problemas/falta-la-cartera',
    );
    expect(buildBackingContent(settleDegraded<Tier>('proof_server_unreachable'), 0).help).toBe(
      'problemas/servidor-local',
    );
    // A reason with nothing specific to say keeps the screen's own article.
    expect(buildBackingContent(settleReady<Tier>('silver'), 0).help).toBe(
      'privacidad/sin-ver-mi-saldo',
    );
  });

  it('rejects a malformed or unknown path', () => {
    expect(helpPathExists('privacidad')).toBe(false);
    expect(helpPathExists('privacidad/no-existe')).toBe(false);
    expect(helpPathExists('no-existe/que-ve-creva')).toBe(false);
    expect(helpPathExists('privacidad/que-ve-creva/extra')).toBe(false);
    expect(helpPathExists('')).toBe(false);
  });

  it('links only to articles it actually has, from every rendered page', () => {
    const pages = [
      renderHelpIndex(),
      ...HELP_CATEGORIES.map((category) => renderHelpCategory(category.slug)),
      ...ARTICLES.map(({ category, article }) => renderHelpArticle(category.slug, article.slug)),
    ];

    for (const html of pages) {
      for (const [, href] of html.matchAll(/href="#\/ayuda\/([^"]+)"/g)) {
        const route = parseHelpRoute(`#/ayuda/${href}`);
        if (route.kind === 'article') {
          expect(findArticle(route.category, route.article), `dead link to ${href}`).toBeDefined();
        } else if (route.kind === 'category') {
          expect(HELP_CATEGORIES.some((c) => c.slug === route.category), `dead link to ${href}`).toBe(true);
        }
      }
    }
  });
});

describe('the help centre never dead-ends', () => {
  it('falls back to the index for an unknown category, and to the category for an unknown article', () => {
    expect(renderHelpCategory('no-existe')).toBe(renderHelpIndex());
    expect(renderHelpArticle('privacidad', 'no-existe')).toBe(renderHelpCategory('privacidad'));
  });

  it('gives every page a way back', () => {
    const pages = [
      renderHelpIndex(),
      ...HELP_CATEGORIES.map((category) => renderHelpCategory(category.slug)),
      ...ARTICLES.map(({ category, article }) => renderHelpArticle(category.slug, article.slug)),
    ];
    for (const html of pages) expect(html).toContain('help-back');
  });
});
