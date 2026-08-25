'use strict';

const epub = require('epub-gen-memory').default;
const MarkdownIt = require('markdown-it');
const footnote = require('markdown-it-footnote');
const { escapeHtml, pickLocalized } = require('./layout');

const md = new MarkdownIt({ html: false, linkify: true, breaks: true }).use(footnote);

function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_');
}

async function renderTranslationEpub(t) {
  const work = t.work;
  const edition = t.edition;
  const authorName = work.author ? pickLocalized(work.author.names) : '(未知作者)';
  const editionPublisher = edition.base_text ? edition.base_text.publisher : null;

  const chapterContent = `
<p>原作・${escapeHtml(authorName)}　譯者・${escapeHtml(t.translatorId)}</p>
${md.render(t.bodyMarkdown)}
<hr>
<p>來源版本：${escapeHtml(editionPublisher || t.edition_url)}(語言:${escapeHtml(edition.language)})<br>本譯文授權：CC BY-SA 4.0</p>
`;

  return epub(
    {
      title: t.title,
      author: [authorName],
      description: t.excerpt || undefined,
      lang: t.language,
      tocTitle: '目錄',
    },
    [{ title: t.title, content: chapterContent }]
  );
}

module.exports = { renderTranslationEpub, sanitizeFilename };
