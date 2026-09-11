'use strict';

// 排程用腳本(見 .github/workflows/update-access-count.yml,一天跑一次):打
// Cloudflare GraphQL Analytics API,用 watermark(lastCountedAt)只查上次查到
// 現在這段新增的區間,累加進 data/access-count.json,避免重複計算。
//
// 檔案不存在/讀取失敗時,視為第一次執行——lastCountedAt 直接設成這次查詢的
// 結束時間,不往回補歷史資料,等於「從現在開始算」，不需要另外手動建種子檔案。
//
// 注意:這裡的 GraphQL query(欄位名稱、dataset 名稱)是照 Cloudflare 文件
// 記憶寫的,沒有實際帳號沒辦法離線驗證過。正式啟用前,務必先用 Cloudflare 的
// GraphQL Analytics API 文件或 explorer 核對一次,確認 httpRequestsAdaptiveGroups
// /clientRequestPath/botScore 這些欄位名稱、以及你的方案是否確實支援。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACCESS_COUNT_PATH = path.join(ROOT, 'data', 'access-count.json');

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

// 邊緣請求寫入 Cloudflare Analytics 系統會有一點延遲,查詢區間的終點往回留一段
// 緩衝,避免剛發生、還沒寫入完成的請求被漏算——下次查詢的起點會接在這次的終點
// 之後,漏在緩衝區裡的那段不會再被補查。
const INGESTION_LAG_BUFFER_MINUTES = 120;

// Cloudflare bot score 是 1-99,分數越低代表越可能是機器人。只是想「簡單排除」,
// 不追求精準,門檻抓寬鬆一點,漏掉幾個機器人不影響。
const BOT_SCORE_THRESHOLD = 30;

const TRANSLATION_PATH_RE = /^\/translations\/([0-9a-f-]{36})\/$/;

function readAccessCount() {
  try {
    return JSON.parse(fs.readFileSync(ACCESS_COUNT_PATH, 'utf8'));
  } catch (e) {
    return { total: 0, translations: {}, lastCountedAt: null };
  }
}

function writeAccessCount(data) {
  fs.mkdirSync(path.dirname(ACCESS_COUNT_PATH), { recursive: true });
  fs.writeFileSync(ACCESS_COUNT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function queryCloudflare(sinceIso, untilIso) {
  const query = `
    query ViewCounts($zoneTag: String!, $since: Time!, $until: Time!, $botScoreMin: Int!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 10000
            filter: { datetime_geq: $since, datetime_lt: $until, botScore_geq: $botScoreMin }
          ) {
            count
            dimensions {
              clientRequestPath
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { zoneTag: CF_ZONE_ID, since: sinceIso, until: untilIso, botScoreMin: BOT_SCORE_THRESHOLD },
    }),
  });

  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(`Cloudflare GraphQL 查詢失敗: ${JSON.stringify(json.errors)}`);
  }

  const zone = json.data && json.data.viewer && json.data.viewer.zones && json.data.viewer.zones[0];
  const groups = (zone && zone.httpRequestsAdaptiveGroups) || [];
  return groups.map((g) => ({ path: g.dimensions.clientRequestPath, count: g.count }));
}

async function updateAccessCount() {
  if (!CF_API_TOKEN || !CF_ZONE_ID) {
    throw new Error('缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ZONE_ID 環境變數');
  }

  const existing = readAccessCount();
  const until = new Date(Date.now() - INGESTION_LAG_BUFFER_MINUTES * 60 * 1000);

  if (!existing.lastCountedAt) {
    // 第一次執行,沒有歷史 watermark 可以接續——直接把這次的結束時間當成起點寫檔,
    // 不查詢、不往回補歷史資料,下次執行開始才會有真正的區間可以累加。
    const initial = { total: 0, translations: {}, lastCountedAt: until.toISOString() };
    writeAccessCount(initial);
    console.log(`第一次執行，初始化 access-count.json，lastCountedAt 設為 ${until.toISOString()}`);
    return initial;
  }

  const since = new Date(existing.lastCountedAt);
  if (since >= until) {
    console.log('距離上次查詢時間太短，沒有新的區間可以查詢，略過。');
    return existing;
  }

  const rows = await queryCloudflare(since.toISOString(), until.toISOString());

  // total 是整站所有路徑的請求數加總(不限譯文頁),跟下面只挑
  // /translations/{uuid}/ 這種路徑累加的單篇統計是分開的兩件事。
  let newTotal = 0;
  const translationDeltas = {};
  for (const { path: p, count } of rows) {
    newTotal += count;
    const m = p.match(TRANSLATION_PATH_RE);
    if (m) {
      translationDeltas[m[1]] = (translationDeltas[m[1]] || 0) + count;
    }
  }

  const merged = {
    total: existing.total + newTotal,
    translations: { ...existing.translations },
    lastCountedAt: until.toISOString(),
  };
  for (const [uuid, delta] of Object.entries(translationDeltas)) {
    merged.translations[uuid] = (merged.translations[uuid] || 0) + delta;
  }

  writeAccessCount(merged);
  console.log(`更新完成：新增 ${newTotal} 次瀏覽（${since.toISOString()} ~ ${until.toISOString()}）`);
  return merged;
}

if (require.main === module) {
  updateAccessCount().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { readAccessCount, writeAccessCount, updateAccessCount };
