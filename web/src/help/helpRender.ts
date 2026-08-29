// helpRender.ts
// All the markup the help centre has: index, category and article. Kept
// separate from helpContent.ts so the content module stays free of HTML and
// migrates into creva_finance by copying, not by stripping tags out of it.

import {
  HELP_CATEGORIES,
  findArticle,
  findCategory,
  type HelpArticle,
  type HelpCategory,
} from './helpContent';
import { helpArticleHref, helpCategoryHref, helpIndexHref } from './helpRoute';

// The ? a screen carries. Same 44px target as the back link, and it always
// names where it goes, so it is never a mystery button.
export function renderHelpLink(path: string, label = 'Preguntas sobre esta pantalla'): string {
  // The visible text is the accessible name: no aria-label repeating it.
  return `<a class="help-link" href="${helpArticleHref(path)}" data-role="help-link"><span class="help-link-mark" aria-hidden="true">?</span><span class="help-link-text">${label}</span></a>`;
}

function backLink(href: string, label: string): string {
  return `<a class="help-back" href="${href}"><span aria-hidden="true">←</span>${label}</a>`;
}

function renderCategoryCard(category: HelpCategory): string {
  return `
    <a class="help-card" href="${helpCategoryHref(category.slug)}">
      <span class="help-card-icon" aria-hidden="true">${category.icon}</span>
      <span class="help-card-copy">
        <span class="help-card-title">${category.title}</span>
        <span class="help-card-lead">${category.lead}</span>
      </span>
      <span class="help-card-chevron" aria-hidden="true">›</span>
    </a>
  `;
}

function renderQuestionRow(categorySlug: string, article: HelpArticle): string {
  return `
    <a class="help-row" href="${helpArticleHref(`${categorySlug}/${article.slug}`)}">
      <span class="help-row-copy">
        <span class="help-row-question">${article.question}</span>
        <span class="help-row-answer">${article.answer}</span>
      </span>
      <span class="help-card-chevron" aria-hidden="true">›</span>
    </a>
  `;
}

export function renderHelpIndex(): string {
  return `
    ${backLink('#', 'Volver a mi solicitud')}
    <h1>¿En qué te ayudamos?</h1>
    <p class="intro">Preguntas que nos hacen seguido, contestadas sin rodeos. Si algo no está aquí, escríbenos.</p>
    <div class="help-list">${HELP_CATEGORIES.map(renderCategoryCard).join('')}</div>
  `;
}

// An unknown category is not an error page: she is sent back to the index,
// which is the one place that always has somewhere to go.
export function renderHelpCategory(categorySlug: string): string {
  const category = findCategory(categorySlug);
  if (!category) return renderHelpIndex();

  return `
    ${backLink(helpIndexHref(), 'Todas las preguntas')}
    <h1><span class="help-title-icon" aria-hidden="true">${category.icon}</span>${category.title}</h1>
    <p class="intro">${category.lead}</p>
    <div class="help-list">
      ${category.articles.map((article) => renderQuestionRow(category.slug, article)).join('')}
    </div>
  `;
}

export function renderHelpArticle(categorySlug: string, articleSlug: string): string {
  const found = findArticle(categorySlug, articleSlug);
  if (!found) return renderHelpCategory(categorySlug);

  const { category, article } = found;
  const steps = article.steps?.length
    ? `<ol class="help-steps">${article.steps.map((step) => `<li>${step}</li>`).join('')}</ol>`
    : '';
  const resolvedBy = article.resolvedBy
    ? `<p class="help-resolved"><span class="help-resolved-label">Qué lo resuelve</span>${article.resolvedBy}</p>`
    : '';
  const note = article.note ? `<p class="help-note">${article.note}</p>` : '';

  return `
    ${backLink(helpCategoryHref(category.slug), category.title)}
    <h1>${article.question}</h1>
    <p class="help-answer">${article.answer}</p>
    ${steps}
    ${resolvedBy}
    ${note}
    <a class="btn-primary help-cta" href="#">Volver a mi solicitud</a>
  `;
}
