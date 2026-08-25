'use strict';

const { escapeHtml, pickLocalized, workDisplayTitle } = require('./layout');

function renderWorkRow(w) {
  return `<a class="entry-row" href="/works/${escapeHtml(w.uuid)}/">
      <div class="entry-title serif">${escapeHtml(workDisplayTitle(w))}</div>
    </a>`;
}

function renderSourceTranslator({ sourceTranslator, works }) {
  const name = pickLocalized(sourceTranslator.names);
  const initial = name.charAt(0);
  const list = works.map(renderWorkRow).join('\n');

  const body = `
<div class="detail-hero">
  <div class="avatar-lg" style="background:#5b6b4f;">${escapeHtml(initial)}</div>
  <h1>${escapeHtml(name)}</h1>
  <div class="detail-meta"><span>譯入語言・${escapeHtml(sourceTranslator.language)}</span></div>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">相關作品 <span class="jp">Related Works</span>(${works.length})</div>
  </div>
  ${works.length ? `<div class="entry-list">${list}</div>` : '<p class="block-empty-note">目前還沒有相關作品。</p>'}
</section>
`;

  return {
    title: name,
    body,
    canonical: `/source-translators/${sourceTranslator.uuid}/`,
    description: `收錄所有由${name}中間翻譯的作品。`,
  };
}

module.exports = { renderSourceTranslator };
