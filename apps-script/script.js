// 觸發器要掛在「表單連結出去的回覆 Sheet」上(From spreadsheet → On form submit),
// 不能掛在表單本身,不然 e.namedValues 不會存在。
//
// 執行前要手動設定好(這兩件事都不會、也不該進版本控制):
// - 這個 Apps Script 專案的「指令碼屬性」要有 GITHUB_PAT,值是跟 GitHub repo secret
//   AUTOMATION_PAT 同一個 PAT。
// - WHITELIST_SHEET_ID 指向的那份試算表,A 欄放允許提交的譯者代稱(有沒有表頭都可以,
//   純文字比對,不會誤判)。

const GITHUB_REPO = 'shellkz/beaconarchive';
const GITHUB_EVENT_TYPE = 'submit-translation';
const WHITELIST_SHEET_ID = '1dbP-fqPmmHXchVw7kWmzwistNfTjbdHYf0BX0ilquJE';

function onFormSubmit(e) {
  const payload = buildPayload_(e.namedValues);

  if (!isWhitelisted_(payload.translatorId)) {
    console.log('不在白名單,略過:' + payload.translatorId);
    return;
  }

  dispatchToGithub_(payload);
}

// namedValues 的每個值都被包成陣列(即使題目只能單選),要取 [0] 拿出純值。
function unwrap_(namedValues, question) {
  const v = namedValues[question];
  return (v && v[0]) || '';
}

function buildPayload_(namedValues) {
  return {
    translatorId: unwrap_(namedValues, '譯者ID'),
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

function isWhitelisted_(translatorId) {
  const sheet = SpreadsheetApp.openById(WHITELIST_SHEET_ID).getSheets()[0];
  const ids = sheet.getRange('A:A').getValues().flat().map(String).map((s) => s.trim());
  return ids.includes(translatorId);
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
