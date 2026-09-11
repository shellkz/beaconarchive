'use strict';

// 獨立的「關於專案」頁,內容原本放在全站共用的 footer 裡(每頁都會重複輸出),
// 移來這裡當一次性頁面,footer 只留最精簡的連結列——見 layout.js。

function renderAbout() {
  const body = `
<div class="detail-hero">
  <h1>關於專案</h1>
  <div class="footer-brand serif">信標文庫</div>
  <p class="footer-note">信標文庫收錄經典日本文學（<a class="ref-link" href="https://www.aozora.gr.jp/">青空文庫</a>）的中文翻譯，可免費線上閱讀，也可下載 EPUB 離線閱讀。</p>
  <p class="footer-note">這是一個非營利且無廣告的翻譯分享平台。翻譯者申請加入後，翻譯來自<a class="ref-link" href="https://www.aozora.gr.jp/">青空文庫</a>的公領域作品，再透過 Google 表單無償提交譯文，發佈到網站上。所有作品皆採用 <a class="ref-link" href="https://creativecommons.org/licenses/by-nc-nd/4.0/">CC BY-NC-ND 4.0</a> 開放授權——可自由轉載（需標註原譯者），但禁止改作與商業使用。</p>
  <p class="footer-note">網站程式碼採用 <a class="ref-link" href="https://opensource.org/license/mit/">MIT</a> 授權開源於 GitHub。</p>
  <div class="hero-actions">
    <a class="btn btn-primary" href="/works/">立即閱讀</a>
    <a class="btn btn-ghost" href="/join/">成為翻譯者</a>
    <a class="btn btn-ghost" href="https://discord.gg/gwBvgR7vb">Discord 諮詢</a>
  </div>
</div>
`;

  return {
    title: '關於專案',
    body,
    canonical: '/about/',
    description:
      '信標文庫收錄經典日本文學（青空文庫）的中文翻譯，可免費線上閱讀，也可下載 EPUB 離線閱讀。這是一個非營利且無廣告的翻譯分享平台。翻譯者申請加入後，翻譯來自青空文庫的公領域作品，再透過 Google 表單無償提交譯文，發佈到網站上。所有作品皆採用 CC BY-NC-ND 4.0 開放授權——可自由轉載（需標註原譯者），但禁止改作與商業使用。',
  };
}

module.exports = { renderAbout };
