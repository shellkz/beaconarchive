// 觸發器要掛在「表單連結出去的回覆 Sheet」上(From spreadsheet → On form submit),
// 不能掛在表單本身,不然 e.namedValues 不會存在。這個腳本專案就是綁定在那份
// Sheet 底下(從它的「擴充功能→Apps Script」開出來的),所以白名單分頁也在
// 同一份試算表裡,直接用 getActiveSpreadsheet() 就拿得到,不用另外存試算表 ID。
//
// 身分驗證是「查表」,不是「自報」:表單本身沒有讓使用者填 id 的欄位,只靠
// Google 表單「收集電子郵件地址(已驗證)」拿到的信箱,去白名單分頁查出對應
// 的 translator_id——查不到就整個略過,不會走到後面任何一步。email 只在這裡
// 用來查表,不會被放進送到 GitHub 的 payload 裡(這個 repo 是公開的,email 是
// 私人資訊,不該出現在會變成公開 log/commit 的地方)。
//
// 執行前要手動設定好(這件事不會、也不該進版本控制):
// - 這個 Apps Script 專案的「指令碼屬性」要有 GITHUB_PAT,值是跟 GitHub repo secret
//   AUTOMATION_PAT 同一個 PAT。
//
// 白名單分頁(WHITELIST_SHEET_GID 指到的那個分頁)欄位順序:A欄 translator_id、
// B欄 email,有沒有表頭都可以,純文字比對不會誤判表頭。
//
// DRY_RUN 開著的時候,查表、組 payload 都會照常跑,但最後不會真的打 GitHub API,
// 只會把本來要送出的內容印到執行紀錄(左側「執行項目」或 View → Logs)裡,
// 確認沒問題後再改回 false。

const DRY_RUN = false;

const GITHUB_REPO = 'shellkz/beaconarchive';
const GITHUB_EVENT_TYPE = 'submit-translation';
const WHITELIST_SHEET_GID = 563189951;

function onFormSubmit(e) {
  const namedValues = e.namedValues;
  const email = unwrap_(namedValues, '電子郵件地址');
  const translatorId = lookupTranslatorId_(email);

  if (!translatorId) {
    console.log('信箱不在白名單,略過:' + email);
    return;
  }

  const payload = buildPayload_(namedValues, translatorId);

  if (DRY_RUN) {
    console.log('DRY RUN,會送出的 payload:' + JSON.stringify(payload));
    return;
  }

  dispatchToGithub_(payload);
}

// namedValues 的每個值都被包成陣列(即使題目只能單選),要取 [0] 拿出純值。
function unwrap_(namedValues, question) {
  const v = namedValues[question];
  return (v && v[0]) || '';
}

function getWhitelistSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .find((s) => s.getSheetId() === WHITELIST_SHEET_GID);
}

function lookupTranslatorId_(email) {
  const rows = getWhitelistSheet_().getRange('A:B').getValues();
  const match = rows.find((row) => String(row[1]).trim() === email);
  return match ? String(match[0]).trim() : null;
}

function buildPayload_(namedValues, translatorId) {
  return {
    translatorId: translatorId,
    sourceUrl: unwrap_(namedValues, '作品來源網址'),
    workWikidataUrl: unwrap_(namedValues, '作品Wikidata連結(選填)'),
    workTitleZh: unwrap_(namedValues, '作品中文標題'),
    workExcerpt: unwrap_(namedValues, '作品客觀中文簡介(選填)'),
    translationExcerpt: unwrap_(namedValues, '作品宣傳中文簡介(選填)'),
    bodyMarkdown: unwrap_(namedValues, '作品中文正文'),
    authorWikidataUrl: unwrap_(namedValues, '作者Wikidata連結(選填)'),
    authorNameZh: unwrap_(namedValues, '作者中文姓名(選填)'),
    authorExcerpt: unwrap_(namedValues, '作者中文簡介(選填)'),
  };
}

// 測試用:在編輯器頂端函式下拉選單選這個函式、按執行(▶),不用真的填表單。
// EMAIL 要換成白名單分頁裡真的存在的一筆信箱,查不到會直接印「不在白名單」。
function testOnFormSubmit_() {
  const fakeEvent = {
    namedValues: {
      '電子郵件地址': ['換成白名單裡的信箱@example.com'],
      '作品來源網址': ['https://www.aozora.gr.jp/cards/000035/card236.html'],
      '作品Wikidata連結(選填)': [''],
      '作品中文標題': ['測試標題'],
      '作品客觀中文簡介(選填)': [''],
      '作品宣傳中文簡介(選填)': ['測試摘要'],
      '作品中文正文': ['測試正文。\n測試正文。\n\n測試正文。'],
      '作者Wikidata連結(選填)': [''],
      '作者中文姓名(選填)': [''],
      '作者中文簡介(選填)': [''],
    },
  };
  onFormSubmit(fakeEvent);
}

function dispatchToGithub_(payload) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_PAT');
  UrlFetchApp.fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
    },
    payload: JSON.stringify({
      event_type: GITHUB_EVENT_TYPE,
      client_payload: payload,
    }),
  });
}
