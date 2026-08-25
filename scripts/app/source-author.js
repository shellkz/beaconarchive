'use strict';

const { escapeHtml, pickLocalized, workDisplayTitle } = require('./layout');

function renderWorkRow(w, translationCount) {
  const nativeTitle = pickLocalized(w.title, ['ja', 'en', 'romaji', 'zh-TW']);
  return `<a class="entry-row" href="/works/${escapeHtml(w.uuid)}/">
      <div class="entry-title serif">${escapeHtml(workDisplayTitle(w))}</div>
      <div class="entry-meta">${escapeHtml(nativeTitle)} · ${translationCount} 個譯本</div>
    </a>`;
}

function renderSourceAuthor({ author, works, translationsByWork }) {
  const name = pickLocalized(author.names);
  const initial = name.charAt(0);
  const list = works.map((w) => renderWorkRow(w, (translationsByWork[w.uuid] || []).length)).join('\n');
  const lifespan = [author.birth_date, author.death_date].filter(Boolean).join(' ~ ');

  const body = `
<div class="detail-hero">
  <div class="avatar-lg" style="background:var(--seal);">${escapeHtml(initial)}</div>
  <h1>${escapeHtml(name)}</h1>
  ${lifespan ? `<div class="detail-meta"><span>生卒・${escapeHtml(lifespan)}</span></div>` : ''}
  ${author.excerpt ? `<p class="desc">${escapeHtml(author.excerpt)}</p>` : ''}
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">作品一覽 <span class="jp">Works</span>(${works.length})</div>
  </div>
  ${works.length ? `<div class="entry-list">${list}</div>` : '<p class="block-empty-note">目前還沒有這位作者的作品被登記。</p>'}
</section>
`;

  return { title: name, body, canonical: `/source-authors/${author.uuid}/`, description: author.excerpt };
}

module.exports = { renderSourceAuthor };
