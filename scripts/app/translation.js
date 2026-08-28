'use strict';

const MarkdownIt = require('markdown-it');
const footnote = require('markdown-it-footnote');
const { escapeHtml, pickLocalized, workDisplayTitle } = require('./layout');
const { sanitizeFilename } = require('./epub');

const SITE_LICENSE = 'CC BY-SA 4.0';
const md = new MarkdownIt({ html: false, linkify: true, breaks: true }).use(footnote);

function renderTranslation(t) {
  const work = t.work;
  const edition = t.edition;
  const authorName = work.author ? pickLocalized(work.author.names) : '(未知作者)';
  const workNativeTitle = pickLocalized(work.title, ['ja', 'en', 'romaji', 'zh-TW']);
  const editionPublisher = edition.base_text ? edition.base_text.publisher : null;
  const sourceTranslatorName = t.sourceTranslator ? pickLocalized(t.sourceTranslator.names) : null;

  const body = `
<div id="reading-settings" class="reading-settings">
  <div class="reading-settings-bar"></div>
  <div class="reading-settings-body">
    <div class="setting-row">
      <span class="setting-label">文字大小</span>
      <div class="setting-control">
        <button type="button" class="setting-btn" data-setting="font-size" data-action="decrease" aria-label="縮小文字">A−</button>
        <button type="button" class="setting-btn" data-setting="font-size" data-action="increase" aria-label="放大文字">A+</button>
      </div>
    </div>
    <div class="setting-row">
      <span class="setting-label">段落間距</span>
      <div class="setting-control">
        <button type="button" class="setting-btn" data-setting="paragraph-spacing" data-action="decrease" aria-label="縮小段落間距">−</button>
        <button type="button" class="setting-btn" data-setting="paragraph-spacing" data-action="increase" aria-label="放大段落間距">+</button>
      </div>
    </div>
    <div class="setting-row">
      <span class="setting-label">主題</span>
      <span class="setting-control">(尚未實作)</span>
    </div>
  </div>
</div>

<div class="breadcrumb">
  <a href="/">首頁</a><span class="sep">›</span>
  <a href="/works/${escapeHtml(work.uuid)}/">${escapeHtml(workDisplayTitle(work))}</a><span class="sep">›</span>
  <span>${escapeHtml(t.title)}</span>
</div>

<div class="article-header">
  ${workNativeTitle ? `<div class="work-jp serif">${escapeHtml(workNativeTitle)}</div>` : ''}
  <h1>${escapeHtml(t.title)}</h1>
  <div class="byline">
    <span>譯者・<a href="/translators/${escapeHtml(t.translatorId)}/">${escapeHtml(t.translatorId)}</a></span>
    <span class="dot">·</span>
    <span>原作・<a href="/source-authors/${escapeHtml(work.author_id)}/">${escapeHtml(authorName)}</a></span>
    ${t.date ? `<span class="dot">·</span><span>${escapeHtml(t.date)}</span>` : ''}
  </div>
</div>

<article class="article-body">
${md.render(t.bodyMarkdown)}
</article>
<div class="article-end-mark">◆ ◆ ◆</div>

<div class="citation-block">
  <div class="citation-card">
    <div class="row"><span class="label">來源版本</span><a href="${escapeHtml(t.edition_url)}">${escapeHtml(editionPublisher || t.edition_url)}</a>(語言:${escapeHtml(edition.language)})</div>
    ${sourceTranslatorName ? `<div class="row"><span class="label">該版本譯者</span><a href="/source-translators/${escapeHtml(t.sourceTranslator.uuid)}/">${escapeHtml(sourceTranslatorName)}</a></div>` : ''}
    <div class="row"><span class="label">本譯文授權</span><span class="license-badge">${escapeHtml(SITE_LICENSE)}</span></div>
    <div class="row"><span class="label">下載</span><a href="/translations/${escapeHtml(t.uuid)}/${escapeHtml(sanitizeFilename(t.title))}.epub">下載 EPUB</a></div>
  </div>
</div>
<script src="/assets/js/reading-settings.js" defer></script>
`;

  return { title: t.title, body, canonical: `/translations/${t.uuid}/`, description: t.excerpt };
}

module.exports = { renderTranslation };
