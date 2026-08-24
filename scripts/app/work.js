'use strict';

const { escapeHtml, pickLocalized, workDisplayTitle } = require('./layout');

function renderEditionRow(e) {
  const publisher = e.base_text ? e.base_text.publisher : null;
  const linkLabel = publisher || e.url;
  const versionDate = e.base_text ? e.base_text.first_version_date : null;
  const metaParts = [e.language, versionDate, e.copyright_status].filter(Boolean).join(' · ');
  return `<div class="edition-row">
      <a href="${escapeHtml(e.url)}">${escapeHtml(linkLabel)}</a>
      <span class="edition-meta">${escapeHtml(metaParts)}</span>
    </div>`;
}

function renderTranslationRow(t) {
  return `<a class="entry-row" href="/translations/${escapeHtml(t.uuid)}/">
      <div class="entry-title">${escapeHtml(t.title)}</div>
      <div class="entry-meta">譯者・${escapeHtml(t.translatorId)}</div>
      <div class="entry-meta">根據版本・${escapeHtml(t.edition_url)}</div>
      ${t.excerpt ? `<div class="entry-excerpt">${escapeHtml(t.excerpt)}</div>` : ''}
    </a>`;
}

function renderWork({ work, translations }) {
  const authorName = work.author ? pickLocalized(work.author.names) : '(未知作者)';
  const nativeTitle = pickLocalized(work.title, ['ja', 'en', 'romaji', 'zh-TW']);
  const tags = work.tags || [];

  const editionsHtml = (work.editions || []).map(renderEditionRow).join('\n');
  const translationsHtml = translations.map(renderTranslationRow).join('\n');
  const tagsHtml = tags
    .map((tg) => `<a class="tag-pill" href="/tags/${escapeHtml(tg)}/">${escapeHtml(tg)}</a>`)
    .join('\n');

  const translationsSection = translations.length
    ? `<div class="entry-list">${translationsHtml}</div>`
    : `<div class="cta-note">這部作品目前還沒有站內譯本——想成為第一個翻譯它的人嗎?見 <a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/翻譯者指南.md">翻譯者指南</a>。</div>`;

  const body = `
<div class="detail-hero">
  ${nativeTitle ? `<div class="eyebrow serif">${escapeHtml(nativeTitle)}</div>` : ''}
  <h1>${escapeHtml(workDisplayTitle(work))}</h1>
  <div class="detail-meta">
    <span>原作者・<a href="/source-authors/${escapeHtml(work.author_id)}/">${escapeHtml(authorName)}</a></span>
    <span>原文語言・${escapeHtml(work.original_language)}</span>
    ${work.category ? `<span>分類・${escapeHtml(work.category)}</span>` : ''}
  </div>
  ${tags.length ? `<div class="tag-pills">${tagsHtml}</div>` : ''}
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">所有譯本 <span class="jp">Translations</span>(${translations.length})</div>
  </div>
  ${translationsSection}
</section>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">來源版本 <span class="jp">Editions</span></div>
  </div>
  <div class="edition-list">${editionsHtml}</div>
</section>


`;

  return { title: workDisplayTitle(work), body, canonical: `/works/${work.uuid}/` };
}

module.exports = { renderWork };
