'use strict';

const { escapeHtml, pickLocalized, formatCharCount } = require('./layout');

function renderEntryRow(t) {
  const workTitle = t.work ? pickLocalized(t.work.title, ['ja', 'en', 'romaji', 'zh-TW']) : '';
  return `<a class="entry-row" href="/translations/${escapeHtml(t.uuid)}/">
      <div class="entry-title">${escapeHtml(t.title)}</div>
      <div class="entry-meta">原作・${escapeHtml(workTitle)}</div>
      ${t.excerpt ? `<div class="entry-excerpt">${escapeHtml(t.excerpt)}</div>` : ''}
    </a>`;
}

function renderTranslator({ translatorId, profile, translations }) {
  const displayName = (profile && profile.display_name) || translatorId;
  const initial = displayName.charAt(0);
  const list = translations.map(renderEntryRow).join('\n');
  const charCount = translations.reduce((sum, t) => sum + t.charCount, 0);

  const body = `
<div class="detail-hero">
  <div class="avatar-lg">${escapeHtml(initial)}</div>
  <h1>${escapeHtml(displayName)}</h1>
  ${profile && profile.bio ? `<p class="desc">${escapeHtml(profile.bio)}</p>` : ''}
  <p class="translator-stats">已發表 ${translations.length} 篇譯文・共 ${escapeHtml(formatCharCount(charCount))}</p>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">翻譯作品 <span class="jp">Translations</span>(${translations.length})</div>
  </div>
  ${translations.length ? `<div class="entry-list">${list}</div>` : '<p class="block-empty-note">這位譯者還沒有發表譯文。</p>'}
</section>
`;

  const description = (profile && profile.bio) || `收錄所有由${displayName}翻譯的作品。`;
  return { title: displayName, body, canonical: `/translators/${translatorId}/`, description };
}

module.exports = { renderTranslator };
