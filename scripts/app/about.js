'use strict';

// 獨立的「關於專案」頁,內容原本放在全站共用的 footer 裡(每頁都會重複輸出),
// 移來這裡當一次性頁面,footer 只留最精簡的連結列——見 layout.js。

function renderAbout() {
  const body = `
<div class="detail-hero">
  <h1>關於專案</h1>
  <div class="footer-brand serif">信標文庫</div>
  <p class="footer-note">這是一個非營利且無廣告的公領域書籍（<a class="ref-link" href="https://www.aozora.gr.jp/">青空文庫</a>）翻譯分享平台。翻譯者透過 Google 表單無償提交譯文，所有作品皆採用 <a class="ref-link" href="https://creativecommons.org/licenses/by-nc-nd/4.0/">CC BY-NC-ND 4.0</a> 開放授權。人人皆可免費閱讀、非商業性轉載（需標註原譯者，禁止改作與商業使用）。</p>
  <p class="footer-note">網站程式碼採用 <a class="ref-link" href="https://opensource.org/license/mit/">MIT</a> 授權開源於 GitHub。</p>
</div>
`;

  return { title: '關於專案', body, canonical: '/about/' };
}

module.exports = { renderAbout };
