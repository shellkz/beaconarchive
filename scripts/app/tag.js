'use strict';

const { escapeHtml, workDisplayTitle } = require('./layout');

function renderEntryRow(t) {
  return `<a class="entry-row" href="/translations/${escapeHtml(t.uuid)}/">
      <div class="entry-title">${escapeHtml(t.title)}</div>
      <div class="entry-meta">原作・${escapeHtml(t.work ? workDisplayTitle(t.work) : '')} · 譯者・${escapeHtml(t.translatorId)}</div>
    </a>`;
}

function renderTag({ tag, translations }) {
  const list = translations.map(renderEntryRow).join('\n');

  const body = `
<div class="detail-hero">
  <div class="eyebrow">標籤 TAG</div>
  <h1>${escapeHtml(tag)}</h1>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">相關譯文 <span class="jp">Translations</span>(${translations.length})</div>
  </div>
  <div class="entry-list">${list}</div>
</section>
`;

  return { title: `標籤:${tag}`, body, canonical: `/tags/${tag}/` };
}

module.exports = { renderTag };
