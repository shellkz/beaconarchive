'use strict';

const { SITE_URL } = require('./layout');

function escapeXmlText(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function renderSitemap(urls) {
  const entries = urls
    .map((url) => `  <url><loc>${escapeXmlText(encodeURI(`${SITE_URL}${url}`))}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

module.exports = { renderSitemap };
