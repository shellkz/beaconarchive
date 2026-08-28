'use strict';

// 共用外殼(<head> + header + footer)。build.js 統一透過這裡輸出每一種頁面
// (homepage/works-index/translation/work/translator/source-author/
// source-translator/tag),刻意設計成跟頁面內容無關,新增頁面類型時只要吃
// { title, body, canonical } 就能直接套用,不用重寫 header/footer/CSS 引用。

// 瀏覽器分頁標題統一結尾,單一位置維護,不用每個頁面 render 模組各自加。
const SITE_NAME = '信標文庫';
const SITE_URL = 'https://beaconarchive.org';
const SITE_DESCRIPTION = '非營利且無廣告的公領域書籍（青空文庫、古騰堡計畫）翻譯分享平台。所有作品皆採用 CC BY-SA 4.0 開放授權。人人皆可免費閱讀、轉載、改作與商用（需標註原譯者）。';

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function pickLocalized(value, fallbackKeyOrder = ['zh-TW', 'romaji', 'ja', 'en']) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  for (const key of fallbackKeyOrder) {
    if (value[key]) return value[key];
  }
  const firstKey = Object.keys(value)[0];
  return firstKey ? value[firstKey] : null;
}

function workDisplayTitle(work) {
  return (work && work.title && work.title['zh-TW']) || '';
}

function formatCharCount(n) {
  if (n < 10000) return `${n}字`;
  if (n < 100000) return `${(n / 10000).toFixed(1)}萬字`;
  return `${Math.round(n / 10000)}萬字`;
}

function renderLayout({ title, body, canonical, description }) {
  const metaDescription = description || SITE_DESCRIPTION;
  const url = canonical ? `${SITE_URL}${canonical}` : SITE_URL;
  return `<!doctype html>
<html lang="zh-Hant" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} | ${escapeHtml(SITE_NAME)}</title>
<meta name="description" content="${escapeHtml(metaDescription)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(metaDescription)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;700;900&family=Shippori+Mincho:wght@400;500;700&family=Noto+Sans+TC:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
<script>document.documentElement.classList.replace('no-js','js');</script>
</head>
<body>
<header>
  <div class="header-inner">
    <a class="logo" href="/">
      <span class="logo-cn serif">信標文庫</span>
    </a>
    <button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="site-nav">
      <span class="sr-only">選單</span>
    </button>
    <nav id="site-nav">
      <a href="/works/">全部作品</a>
      <a href="/about/">關於</a>
    </nav>
  </div>
</header>

${body}

<footer>
  <div class="footer-inner">
    <div class="footer-links">
      <a href="https://github.com/shellkz/PublicTranslationWebsite">原始碼</a>
      <a href="/about/">關於專案</a>
    </div>
    <p class="footer-note">本專案收錄之原始文字作品皆已進入公領域 (Public Domain)。<br>由社群無償貢獻之翻譯文本，著作權歸原譯者所有，並統一以 <a class="ref-link" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> 授權釋出。<br>網站原始碼採用 <a class="ref-link" href="https://opensource.org/license/mit/">MIT</a> 授權開源於 GitHub。</p>
  </div>
</footer>
<script src="/assets/js/nav-toggle.js" defer></script>
</body>
</html>
`;
}

module.exports = { renderLayout, escapeHtml, pickLocalized, workDisplayTitle, formatCharCount, SITE_URL };
