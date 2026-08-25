'use strict';

// 獨立的「關於專案」頁,內容原本放在全站共用的 footer 裡(每頁都會重複輸出),
// 移來這裡當一次性頁面,footer 只留最精簡的連結列——見 layout.js。

function renderAbout() {
  const body = `
<div class="detail-hero">
  <h1>關於專案</h1>
  <div class="footer-brand serif">信標文庫</div>
  <p class="footer-note">這是一個非營利且無廣告的公領域書籍（<a class="ref-link" href="https://www.aozora.gr.jp/">青空文庫</a>、<a class="ref-link" href="https://www.gutenberg.org/">古騰堡計畫</a>）翻譯分享平台。翻譯者透過 GitHub 無償提交譯文，所有作品皆採用 <a class="ref-link" href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/LICENSE">CC BY-SA 4.0</a> 開放授權。人人皆可免費閱讀、轉載、改作與商用（需標註原譯者）。</p>
  <p class="footer-note">網站程式碼採用 <a class="ref-link" href="https://opensource.org/license/mit/">MIT</a> 授權開源於 GitHub。</p>
</div>
`;

  return { title: '關於專案', body, canonical: '/about/' };
}

module.exports = { renderAbout };
