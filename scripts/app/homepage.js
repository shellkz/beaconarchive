'use strict';

const { escapeHtml, pickLocalized, formatCharCount } = require('./layout');

const COVER_CLASSES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const AVATAR_COLORS = ['var(--indigo)', 'var(--seal)', '#5b6b4f', '#8a6a3f', '#3a5560', '#7a3f56'];

function renderSearchForm() {
  return `
<section class="block" id="search" style="padding-bottom:0;">
  <form method="get" action="/works/" class="home-search">
    <input type="search" name="q" placeholder="搜尋作品標題" aria-label="搜尋作品標題">
    <button type="submit" aria-label="搜尋">🔍</button>
  </form>
</section>`;
}

function renderMetaField(label, value) {
  return `<div class="card-meta"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span></div>`;
}

function renderLatestCard(t, index) {
  const coverClass = COVER_CLASSES[index % COVER_CLASSES.length];
  const author = t.work && t.work.author;
  const authorName = author ? pickLocalized(author.names) : '(未知作者)';
  const workNativeTitle = t.work ? pickLocalized(t.work.title, ['ja', 'en', 'romaji', 'zh-TW']) : '';
  return `<a class="card" href="/translations/${escapeHtml(t.uuid)}/">
      <div class="cover ${coverClass}">
        <span class="cover-title">${escapeHtml(t.title)}</span>
      </div>
      <div class="card-title-cn">${escapeHtml(workNativeTitle)}</div>
      ${renderMetaField('作者', authorName)}
      ${renderMetaField('譯者', t.translatorId)}
      ${t.date ? renderMetaField('更新於', t.date) : ''}
    </a>`;
}

function renderTranslatorCard(translatorId, profile, translations, index) {
  const displayName = (profile && profile.display_name) || translatorId;
  const initial = displayName.charAt(0);
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const charCount = translations.reduce((sum, t) => sum + t.charCount, 0);
  return `<a class="t-card" href="/translators/${escapeHtml(translatorId)}/">
      <div class="t-avatar" style="background:${color};">${escapeHtml(initial)}</div>
      <div>
        <div class="t-name">${escapeHtml(displayName)}</div>
        <div class="t-desc">${escapeHtml((profile && profile.bio) || '這位譯者還沒有寫自我介紹。')}</div>
        <div class="t-count">累積 ${translations.length} 篇譯文・${escapeHtml(formatCharCount(charCount))}</div>
      </div>
    </a>`;
}

function renderHomepage({ latestTranslations, translators, translationsByTranslator }) {
  const latestHtml = latestTranslations.map(renderLatestCard).join('\n');
  const translatorIds = Object.keys(translationsByTranslator);
  const translatorsHtml = translatorIds
    .map((id, i) => renderTranslatorCard(id, translators[id], translationsByTranslator[id], i))
    .join('\n');

  const body = `
${renderSearchForm()}

<section class="block" id="latest">
  <div class="block-head">
    <div class="block-title serif">最新譯作 <span class="jp">Latest Translations</span></div>
  </div>
  ${latestTranslations.length ? `<div class="grid">${latestHtml}</div>` : '<p class="block-empty-note">目前還沒有譯文,敬請期待。</p>'}
</section>

<section class="block" id="translators">
  <div class="block-head">
    <div class="block-title serif">譯者一覽 <span class="jp">Translators</span></div>
  </div>
  ${translatorIds.length ? `<div class="translator-grid">${translatorsHtml}</div>` : '<p class="block-empty-note">目前還沒有譯者,敬請期待。</p>'}
</section>
`;

  return { title: '首頁', body };
}

module.exports = { renderHomepage, renderMetaField, COVER_CLASSES };
