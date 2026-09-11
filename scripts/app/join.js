'use strict';

// 「加入我們」頁,面向想成為翻譯者的人——跟 about.js(面向讀者)刻意分開,
// 兩邊的資訊目的不同,合在一頁會兩邊都寫不深。流程是先填申請表單、人工審查
// (只用來判斷是不是真人,不審翻譯能力)、通過後寄信附教學文件跟 Discord 連結。

const APPLY_FORM_URL = 'https://forms.gle/QcDRytEntNRkbdN17';

function renderJoin() {
  const body = `
<div class="detail-hero">
  <h1>成為翻譯者</h1>
  <div class="footer-brand serif">信標文庫</div>
  <p class="footer-note">信標文庫是一個非營利且無廣告的翻譯分享平台，收錄經典日本文學（青空文庫）的中文翻譯。</p>

  <div class="page-section">
    <h2>你可以做什麼</h2>
    <p class="footer-note">沒有金錢報酬，翻譯來自青空文庫的公領域作品，發佈到網站上。除了可以累積翻譯作品的經驗，網站也提供譯者個人頁面，列出你翻譯過的所有作品，並能自訂顯示自我介紹與宣傳資訊。建議先挑選短篇的作品翻譯，能快速建立信心與手感，同時累積作品數量，也沒有版權疑慮。</p>
  </div>

  <div class="page-section">
    <h2>翻譯授權</h2>
    <p class="footer-note">所有譯文統一採用 <a class="ref-link" href="https://creativecommons.org/licenses/by-nc-nd/4.0/">CC BY-NC-ND 4.0</a> 授權。</p>
    <ul class="license-terms">
      <li><strong>其他人可以：</strong>免費閱讀、下載、原封不動地轉載分享，或合理引用節錄用於評論、寫作參考（須標註你的譯者身分）</li>
      <li><strong>其他人不可以：</strong>大量改寫、重製譯文內容並發表成另一個版本，或將譯文用於商業用途（例如收錄進販售的書籍、放在以此內容營利的網站）</li>
      <li><strong>你自己：</strong>依然保有這份譯文的著作權，網站沒有取得任何著作權轉讓——你可以自行把同一份譯文另外發表在其他地方，不受此授權限制；如果有人想商業使用你的譯文，需要另外取得你本人同意，網站沒辦法代為授權</li>
    </ul>
  </div>

  <div class="page-section">
    <h2>跟傳統協作翻譯社群的不同之處</h2>
    <p class="footer-note">沒有黑箱審查——譯文提交後直接上線，不用等待審核通過。同一部作品可以同時存在多個不同譯者的版本，讀者能自由比較。維護者只會事後修正錯字，或移除原文沒有的置入內容、惡意破壞的內容，不會因為翻譯風格或品質擋下你的作品。</p>
  </div>

  <div class="page-section">
    <h2>加入流程</h2>
    <ol>
      <li>填寫<a class="ref-link" href="${APPLY_FORM_URL}">申請加入表單</a></li>
      <li>等待人工審查申請（不審查翻譯能力，只用來判斷是不是真人）</li>
      <li>審查通過後，會收到 email 通知，附上翻譯提交表單、教學文件</li>
      <li>之後透過翻譯提交表單發表作品</li>
      <li>等待大約十分鐘，發布到網站上</li>
    </ol>
  </div>

  <div class="hero-actions">
    <a class="btn btn-ghost" href="https://discord.gg/gwBvgR7vb">Discord 諮詢</a>
  </div>
</div>
`;

  return { title: '成為翻譯者', body, canonical: '/join/' };
}

module.exports = { renderJoin };
