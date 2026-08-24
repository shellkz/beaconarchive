'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { resolveAll, extractSiteId } = require('../scripts/build');
const { WorkSchema, SourceAuthorSchema, TranslationFrontmatterSchema } = require('../scripts/models');
const { parseAozoraWork } = require('./lib/parseAozoraWork');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

function slugifyRomaji(romaji) {
  return romaji
    .toLowerCase()
    .replace(/,/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function readFrontmatter(fullPath) {
  return matter(fs.readFileSync(fullPath, 'utf8'), {
    engines: { yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) },
  });
}

// commentLines 是「選填但值得提醒」的欄位,不寫進真正的資料裡(避免忘記填時
// 留下空字串/假值被 commit 出去),而是以 YAML 註解的形式附在 frontmatter
// 區塊尾端——填不填都不影響資料本身乾不乾淨,但比 CLI 執行完就消失的 stdout
// 提示更持久,PR review 的人也看得到。
function writeFrontmatter(fullPath, data, commentLines = [], body = '') {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  let content = matter.stringify(body, data);
  if (commentLines.length) {
    const commentBlock = commentLines.map((c) => `# ${c}`).join('\n');
    content = content.replace(/\n---\n/, `\n${commentBlock}\n---\n`);
  }
  fs.writeFileSync(fullPath, content, 'utf8');
}

function findBySiteId(candidateUrl, items, urlsOf) {
  const targetId = extractSiteId(candidateUrl);
  if (!targetId) return null;
  for (const item of items) {
    for (const url of urlsOf(item)) {
      if (extractSiteId(url) === targetId) return item;
    }
  }
  return null;
}

async function fetchCandidate(workUrl) {
  const res = await fetch(workUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const parsed = parseAozoraWork(workUrl, html);

  const authorCandidate = SourceAuthorSchema.parse({
    uuid: crypto.randomUUID(),
    names: {
      ja: parsed.author.name,
      ...(parsed.author.romaji ? { romaji: parsed.author.romaji } : {}),
    },
    url: parsed.author.url,
    ...(parsed.author.birth_date ? { birth_date: parsed.author.birth_date } : {}),
    ...(parsed.author.death_date ? { death_date: parsed.author.death_date } : {}),
    ...(parsed.author.excerpt ? { excerpt: parsed.author.excerpt } : {}),
  });

  const editionCandidate = {
    url: parsed.edition.url,
    language: parsed.edition.language,
    copyright_status: parsed.edition.copyright_status,
    translator_id: null,
    ...(parsed.edition.base_text ? { base_text: parsed.edition.base_text } : {}),
  };

  const workCandidate = WorkSchema.parse({
    uuid: crypto.randomUUID(),
    title: { ja: parsed.work.title },
    author_id: authorCandidate.uuid,
    original_language: 'ja',
    ...(parsed.firstPublished && parsed.firstPublished.date
      ? { first_published: { title: parsed.firstPublished.title, date: parsed.firstPublished.date } }
      : {}),
    editions: [editionCandidate],
  });

  return { authorCandidate, workCandidate, editionCandidate, parsed };
}

async function run(workUrl, translatorId) {
  console.log(`\n=== ${workUrl} ===`);

  const { authorCandidate, workCandidate, editionCandidate, parsed } = await fetchCandidate(workUrl);
  console.log('抓取 + zod 驗證通過');

  const graph = resolveAll();

  const existingAuthor = findBySiteId(authorCandidate.url, Object.values(graph.sourceAuthors), (a) =>
    a.url ? [a.url] : []
  );
  const existingWork = findBySiteId(editionCandidate.url, Object.values(graph.works), (w) =>
    (w.editions || []).map((e) => e.url)
  );

  const reminders = [`edition.copyright_status 目前預設「日本公版」,請確認`];

  // ---- stage 5:落地寫檔(記憶體物件確認完才寫,一次寫完) ----

  let authorId;
  if (existingAuthor) {
    authorId = existingAuthor.uuid;
    console.log(`author 重複 → 沿用既有 ${authorId}(${existingAuthor.sourcePath})`);
  } else {
    authorId = authorCandidate.uuid;
    const authorComments = ['wikidata_id: (選填,自己去 wikidata.org 查)'];
    if (!parsed.author.birth_date) authorComments.push('birth_date: (選填)');
    if (!parsed.author.death_date) authorComments.push('death_date: (選填)');

    const authorPath = path.join(
      CONTENT_DIR,
      'source-authors',
      `${slugifyRomaji(authorCandidate.names.romaji || authorCandidate.names.ja)}.md`
    );
    writeFrontmatter(authorPath, authorCandidate, authorComments);
    console.log(`寫入新作者:${path.relative(ROOT, authorPath)}`);
    reminders.push(`SourceAuthor.names 缺少 zh-TW,請補上中文譯名`);
    reminders.push(`SourceAuthor.excerpt 目前是原文日文,請翻譯成中文`);
  }

  let workId;
  if (existingWork) {
    workId = existingWork.uuid;
    const editionExists = (existingWork.editions || []).some(
      (e) => extractSiteId(e.url) === extractSiteId(editionCandidate.url)
    );
    if (editionExists) {
      console.log(`work + edition 都已存在 → 沿用既有 ${workId}(${existingWork.sourcePath}),不寫檔案`);
    } else {
      const rawPath = path.join(ROOT, existingWork.sourcePath);
      const raw = readFrontmatter(rawPath);
      const merged = { ...raw.data, editions: [...(raw.data.editions || []), editionCandidate] };
      WorkSchema.parse(merged);
      fs.writeFileSync(rawPath, matter.stringify(raw.content, merged), 'utf8');
      console.log(`work 已存在,新版本併入:${existingWork.sourcePath}`);
    }
  } else {
    workId = workCandidate.uuid;
    workCandidate.author_id = authorId;
    const workComments = [
      'wikidata_id: (選填,自己去 wikidata.org 查)',
      `category: (選填,原始分類 ${parsed.work.categoryHint || '未知'})`,
      'excerpt: (選填,簡短介紹這部作品)',
    ];
    const workPath = path.join(CONTENT_DIR, 'works', `${sanitizeFilename(workCandidate.title.ja)}.md`);
    writeFrontmatter(workPath, workCandidate, workComments);
    console.log(`寫入新作品:${path.relative(ROOT, workPath)}`);
    reminders.push(`Work.title 缺少 zh-TW,請補上中文標題`);
  }

  reminders.push(`base_text/first_published 的日期是原始日文格式,視需要自行轉成 ISO`);

  // ---- stage 6:建立譯文檔案(正文留空,等使用者貼上) ----

  const translationData = TranslationFrontmatterSchema.parse({
    uuid: crypto.randomUUID(),
    title: 'TODO：翻譯標題',
    work_id: workId,
    edition_url: editionCandidate.url,
    language: 'zh-TW',
  });
  const translationPath = path.join(
    CONTENT_DIR,
    'translators',
    translatorId,
    `${sanitizeFilename(workCandidate.title.ja)}.md`
  );
  writeFrontmatter(translationPath, translationData, ['excerpt: (選填,簡短介紹這篇譯文)'], '');
  console.log(`寫入譯文檔案(正文留空):${path.relative(ROOT, translationPath)}`);
  reminders.push(`譯文檔案:title 是佔位文字、date 還沒填,正文請貼上翻譯`);

  // ---- stage 7:提示待辦 ----

  console.log('\n--- 待確認 ---');
  reminders.forEach((r) => console.log(`- ${r}`));
}

async function main() {
  const args = process.argv.slice(2);
  const workUrl = args[0];
  const translatorId = args[1] || 'shellkz';
  if (!workUrl) {
    console.error('用法:node cli/translate.js <work-url> [translatorId]');
    process.exit(1);
  }
  try {
    await run(workUrl, translatorId);
  } catch (err) {
    console.error(`\n失敗:`, err.message);
    process.exit(1);
  }
}

main();
