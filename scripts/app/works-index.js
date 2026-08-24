'use strict';

const { escapeHtml, pickLocalized, workDisplayTitle } = require('./layout');
const { renderMetaField, COVER_CLASSES } = require('./homepage');

function renderCard({ work, translationCount, translatorIds }, index) {
  const coverClass = COVER_CLASSES[index % COVER_CLASSES.length];
  const isEmpty = translationCount === 0;
  const authorName = work.author ? pickLocalized(work.author.names) : '(未知作者)';
  const nativeTitle = pickLocalized(work.title, ['ja', 'en', 'romaji', 'zh-TW']);
  const dataAttrs = [
    `data-title="${escapeHtml(workDisplayTitle(work))}"`,
    `data-author="${escapeHtml(authorName)}"`,
    `data-translator="${escapeHtml((translatorIds || []).join(','))}"`,
    `data-category="${escapeHtml(work.category || '')}"`,
    `data-language="${escapeHtml(work.original_language || '')}"`,
    `data-tags="${escapeHtml((work.tags || []).join(','))}"`,
  ].join(' ');

  return `<a class="card${isEmpty ? ' card-empty' : ''}" href="/works/${escapeHtml(work.uuid)}/" ${dataAttrs}>
      <div class="cover ${coverClass}">
        <span class="cover-title">${escapeHtml(workDisplayTitle(work))}</span>
        <span class="cover-count${isEmpty ? ' is-empty' : ''}">${translationCount} 個譯本</span>
      </div>
      <div class="card-title-cn">${escapeHtml(nativeTitle)}</div>
      ${renderMetaField('作者', authorName)}
      ${isEmpty ? '<div class="needs-translator">尚無譯者・想挑戰看看?</div>' : ''}
    </a>`;
}

function renderFilters({ categories, languages, tags }) {
  const categoryOptions = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const languageOptions = languages.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  const tagCheckboxes = tags
    .map((t) => `<label><input type="checkbox" value="${escapeHtml(t)}"> ${escapeHtml(t)}</label>`)
    .join('\n');

  return `
<form id="works-filters" class="works-filters">
  <div class="filter-field">
    <label for="f-search">作品標題</label>
    <input type="search" id="f-search" placeholder="搜尋作品標題">
  </div>
  <div class="filter-field">
    <label for="f-author">原作者</label>
    <input type="text" id="f-author" placeholder="搜尋原作者">
  </div>
  <div class="filter-field">
    <label for="f-translator">譯者</label>
    <input type="text" id="f-translator" placeholder="搜尋譯者">
  </div>
  <div class="filter-field">
    <label for="f-category">分類</label>
    <select id="f-category"><option value="">全部</option>${categoryOptions}</select>
  </div>
  <div class="filter-field">
    <label for="f-language">原文語言</label>
    <select id="f-language"><option value="">全部</option>${languageOptions}</select>
  </div>
  <fieldset class="filter-tags">
    <legend>標籤</legend>
    <div class="filter-tags-options">${tagCheckboxes}</div>
  </fieldset>
</form>`;
}

function renderWorksIndex({ works, translationsByWork }) {
  const entries = Object.values(works).map((work) => {
    const workTranslations = translationsByWork[work.uuid] || [];
    return {
      work,
      translationCount: workTranslations.length,
      translatorIds: [...new Set(workTranslations.map((t) => t.translatorId))],
    };
  });

  const cardsHtml = entries.map(renderCard).join('\n');
  const categories = [...new Set(Object.values(works).map((w) => w.category).filter(Boolean))].sort();
  const languages = [...new Set(Object.values(works).map((w) => w.original_language).filter(Boolean))].sort();
  const tags = [...new Set(Object.values(works).flatMap((w) => w.tags || []))].sort();

  const body = `
<div class="detail-hero">
  <h1>全部作品</h1>
</div>
${renderFilters({ categories, languages, tags })}
<section class="block">
  <div id="works-grid" class="grid">${cardsHtml}</div>
  <p id="works-empty-note" class="block-empty-note" style="display:none;">找不到符合條件的作品。</p>
</section>
<script src="/assets/js/works-filter.js" defer></script>
`;

  return { title: '全部作品', body, canonical: '/works/' };
}

module.exports = { renderWorksIndex };
