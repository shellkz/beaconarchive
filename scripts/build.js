'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const MarkdownIt = require('markdown-it');
const {
  WorkSchema,
  SourceAuthorSchema,
  SourceTranslatorSchema,
  TranslatorSchema,
  TranslationFrontmatterSchema,
} = require('./models');
const { renderLayout } = require('./app/layout');
const { renderHomepage } = require('./app/homepage');
const { renderTranslation } = require('./app/translation');
const { renderWork } = require('./app/work');
const { renderTranslator } = require('./app/translator');
const { renderSourceAuthor } = require('./app/source-author');
const { renderSourceTranslator } = require('./app/source-translator');
const { renderTag } = require('./app/tag');
const { renderWorksIndex } = require('./app/works-index');
const { renderWorkshop } = require('./app/workshop');
const { renderAbout } = require('./app/about');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUT_DIR = path.join(ROOT, 'dist');

const md = new MarkdownIt({ html: false, linkify: true });

// 全站譯文授權固定,不是逐篇 frontmatter 欄位——見 /LICENSE、/CONTRIBUTING.md
const SITE_LICENSE = 'CC BY-SA 4.0';

// ---------- small helpers ----------

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function readDescription(dir) {
  const file = path.join(dir, 'description.md');
  if (!fs.existsSync(file)) return {};
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  return parsed.data || {};
}

function pickLocalized(value, fallbackKeyOrder = ['zh', 'romaji', 'ja', 'en']) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  for (const key of fallbackKeyOrder) {
    if (value[key]) return value[key];
  }
  const firstKey = Object.keys(value)[0];
  return firstKey ? value[firstKey] : null;
}

// 給讀者看的「這部作品叫什麼」,一律直接用 title.zh,不做語言 fallback——
// 顯示原文(如日文假名)對只讀中文的讀者沒有意義,尤其是放大顯示的封面標題。
// 只有明確要展示「原文標題」當引用/小字副標(如 translation.js 的 .work-jp、
// work.js 的 .eyebrow)才用 pickLocalized(title, ['ja','en','romaji','zh']) 保留原文。
function workDisplayTitle(work) {
  return (work && work.title && work.title.zh) || '';
}

// gray-matter (js-yaml) auto-parses YYYY-MM-DD strings into Date objects;
// normalize back to plain date strings so rendering is consistent everywhere.
function toPlainDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

// 譯者貢獻字數統計:只算正文(不含標題/摘要等其他欄位),流程是 markdown
// 轉 HTML(跟頁面渲染同一支 markdown-it 實例,標題/粗體/連結等語法都會被
// 正確轉換,不是直接對 markdown 原始碼硬砍符號)→ 剝掉 HTML 標籤 → 還原
// markdown-it 會跳脫的幾個標準 HTML 實體 → 去除空白類字元(含全形空白,
// JS 的 \s 不會吃到)→ 數剩下字串的長度。
function countProseChars(markdown) {
  const html = md.render(markdown || '');
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\s　]/g, '');
  return text.length;
}

// 中文常見的字數顯示慣例:低於一萬直接顯示數字;一萬~十萬顯示到小數點
// 後一位的「萬」;超過十萬只顯示整數「萬」,不顯示小數。
function formatCharCount(n) {
  if (n < 10000) return `${n}字`;
  if (n < 100000) return `${(n / 10000).toFixed(1)}萬字`;
  return `${Math.round(n / 10000)}萬字`;
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeHtml(outPath, html) {
  ensureDirFor(outPath);
  fs.writeFileSync(outPath, html, 'utf8');
}

function writePage(outPath, { title, body, canonical }) {
  writeHtml(outPath, renderLayout({ title, body, canonical }));
}

// ---------- load registries ----------

// translators/ 是唯一維持資料夾的類別(自身 profile + 多篇譯文的容器),
// 資料夾名稱本身就是識別碼,沿用舊有的「掃資料夾、讀 description.md」邏輯。
function loadRegistry(subdir) {
  const dir = path.join(CONTENT_DIR, subdir);
  const map = {};
  for (const id of listDirs(dir)) {
    map[id] = { id, ...readDescription(path.join(dir, id)) };
  }
  return map;
}

// works / source-authors / source-translators:單一檔案,不是資料夾,
// 真正的識別碼是檔案內容裡的 uuid 欄位,檔名只是給人看的可讀前綴——見架構規格.md 第 1、2 節。
function loadFlatRegistry(subdir, categoryLabel) {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return {};

  const map = {};
  const errors = [];

  for (const filename of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const fullPath = path.join(dir, filename);
    const sourcePath = path.relative(ROOT, fullPath);
    const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
    const data = parsed.data || {};

    if (!data.uuid) {
      errors.push(`[${sourcePath}] 缺少必填的 uuid 欄位`);
      continue;
    }
    if (map[data.uuid]) {
      errors.push(`[${sourcePath}] uuid "${data.uuid}" 與 [${map[data.uuid].sourcePath}] 重複,同一類別內 uuid 不得重複`);
      continue;
    }

    if (Array.isArray(data.editions)) {
      data.editions = data.editions.map((e) => ({ ...e, date: toPlainDate(e.date) }));
    }
    map[data.uuid] = { ...data, sourcePath, filename };
  }

  if (errors.length) {
    throw new Error(`${categoryLabel} uuid 檢查失敗:\n` + errors.map((e) => '  - ' + e).join('\n'));
  }

  return map;
}

function loadTranslations() {
  const translatorsDir = path.join(CONTENT_DIR, 'translators');
  const translations = [];
  const seenUuids = new Map();
  const errors = [];

  for (const translatorId of listDirs(translatorsDir)) {
    const translatorDir = path.join(translatorsDir, translatorId);
    const files = fs
      .readdirSync(translatorDir)
      .filter((f) => f.endsWith('.md') && f !== 'description.md');

    for (const filename of files) {
      const fullPath = path.join(translatorDir, filename);
      const sourcePath = path.relative(ROOT, fullPath);
      const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
      const frontmatter = parsed.data || {};
      frontmatter.date = toPlainDate(frontmatter.date);

      if (!frontmatter.uuid) {
        errors.push(`[${sourcePath}] 缺少必填的 uuid 欄位`);
        continue;
      }
      if (seenUuids.has(frontmatter.uuid)) {
        errors.push(`[${sourcePath}] uuid "${frontmatter.uuid}" 與 [${seenUuids.get(frontmatter.uuid)}] 重複,全站譯文 uuid 不得重複`);
        continue;
      }
      seenUuids.set(frontmatter.uuid, sourcePath);

      translations.push({
        uuid: frontmatter.uuid,
        filename,
        translatorId,
        frontmatter,
        bodyMarkdown: parsed.content || '',
        charCount: countProseChars(parsed.content || ''),
        sourcePath,
      });
    }
  }

  if (errors.length) {
    throw new Error('譯文 uuid 檢查失敗:\n' + errors.map((e) => '  - ' + e).join('\n'));
  }

  return translations;
}

// ---------- 跨檔重複偵測(硬性擋下,不是只警告)見架構規格.md 第 6 節 ----------

// 青空文庫「作品資訊頁」(card{N}.html)跟「本文頁」(files/{N}_xxxxx.html)
// 用的是同一個作品編號,古騰堡「作品資訊頁」(ebooks/{N})跟「本文頁」
// (cache/epub/{N}/...)也是同一個編號——三個群組都要能各自解析出編號,
// 跟 assets/js/workshop.js 的 AOZORA_WORK_RE/GUTENBERG_WORK_RE 等呼應。
const AOZORA_ID_RE = /aozora\.gr\.jp\/(?:cards\/\d+\/files\/(\d+)|cards\/\d+\/card(\d+)\.html|index_pages\/person(\d+))/;
const GUTENBERG_ID_RE = /gutenberg\.org\/(?:ebooks\/author\/(\d+)|ebooks\/(\d+)|cache\/epub\/(\d+))/;

function extractSiteId(url) {
  if (!url) return null;
  const aozora = url.match(AOZORA_ID_RE);
  if (aozora) return `aozora:${aozora[1] || aozora[2] || aozora[3]}`;
  const gutenberg = url.match(GUTENBERG_ID_RE);
  if (gutenberg) return `gutenberg:${gutenberg[1] || gutenberg[2] || gutenberg[3]}`;
  return null;
}

// 目前只收青空文庫、古騰堡計畫這兩個來源(以及未來可能新增的其他明確
// 來源)——不再接受「自己找到的公版書」這種來源不明的網址,避免自行
// 認定公版狀態帶來的著作權風險,見翻譯者指南.md。這裡才是真正的把關,
// workshop 表單上的 pattern 屬性只是先在前端擋一次,擋不住的人(手動編輯
// 檔案、不透過工具直接送 PR)還是要靠這裡。
const AOZORA_WORK_URL_RE = /^https:\/\/www\.aozora\.gr\.jp\/cards\/\d+\/(?:card\d+\.html|files\/\d+_\d+\.html)$/;
const GUTENBERG_WORK_URL_RE = /^https:\/\/www\.gutenberg\.org\/(?:ebooks\/\d+\/?|cache\/epub\/\d+\/.+)$/;

function isRecognizedEditionUrl(url) {
  return AOZORA_WORK_URL_RE.test(url) || GUTENBERG_WORK_URL_RE.test(url);
}

function validateEditionUrls(works) {
  const errors = [];
  for (const work of Object.values(works)) {
    for (const edition of Array.isArray(work.editions) ? work.editions : []) {
      if (edition.url && !isRecognizedEditionUrl(edition.url)) {
        errors.push(
          `[${work.sourcePath}] editions[].url "${edition.url}" 不是目前支援的來源格式(僅接受青空文庫、古騰堡計畫的作品資訊頁/本文頁連結)`
        );
      }
    }
  }
  return errors;
}

// works 用 editions[].url(可能多筆),source-authors/source-translators 用 source_url(單一)
function collectCandidateUrls(entry) {
  if (Array.isArray(entry.editions)) return entry.editions.map((e) => e.url);
  if (entry.source_url) return [entry.source_url];
  return [];
}

function detectDuplicates(map, categoryLabel) {
  const byWikidata = {};
  const bySiteId = {};

  for (const [uuid, entry] of Object.entries(map)) {
    if (entry.wikidata_id) {
      (byWikidata[entry.wikidata_id] ||= []).push(uuid);
    } else {
      for (const url of collectCandidateUrls(entry)) {
        const siteId = extractSiteId(url);
        if (siteId) (bySiteId[siteId] ||= new Set()).add(uuid);
      }
    }
  }

  const errors = [];
  for (const [wid, uuids] of Object.entries(byWikidata)) {
    if (uuids.length > 1) {
      errors.push(`${categoryLabel}:wikidata_id "${wid}" 同時被 ${uuids.length} 筆資料使用(${uuids.join(', ')}),判定重複登記`);
    }
  }
  for (const [sid, uuids] of Object.entries(bySiteId)) {
    if (uuids.size > 1) {
      errors.push(`${categoryLabel}:來源站編號 "${sid}" 同時被 ${[...uuids].join(', ')} 引用,判定重複登記`);
    }
  }
  return errors;
}

// ---------- resolve references ----------

function resolveAll() {
  const works = loadFlatRegistry('works', 'works/');
  const sourceAuthors = loadFlatRegistry('source-authors', 'source-authors/');
  const sourceTranslators = loadFlatRegistry('source-translators', 'source-translators/');
  const translators = loadRegistry('translators');
  const translations = loadTranslations();

  const errors = [
    ...detectDuplicates(works, 'works'),
    ...detectDuplicates(sourceAuthors, 'source-authors'),
    ...detectDuplicates(sourceTranslators, 'source-translators'),
    ...validateEditionUrls(works),
  ];

  for (const t of translations) {
    const fm = t.frontmatter;

    const work = works[fm.work_id];
    if (!work) {
      errors.push(`[${t.sourcePath}] work_id "${fm.work_id}" 在 /content/works/ 找不到 uuid 相符的檔案`);
      continue;
    }
    t.work = work;

    const author = sourceAuthors[work.author_id];
    if (!author) {
      errors.push(`[${t.sourcePath}] 作品 "${work.sourcePath}" 的 author_id "${work.author_id}" 在 /content/source-authors/ 找不到 uuid 相符的檔案`);
    }
    t.author = author || null;

    const editions = Array.isArray(work.editions) ? work.editions : [];
    const edition = editions.find((e) => e.url === fm.edition_url);
    if (!edition) {
      errors.push(`[${t.sourcePath}] edition_url "${fm.edition_url}" 在作品 "${work.sourcePath}" 的 editions 清單裡找不到相符項目`);
    }
    t.edition = edition || null;

    if (edition && edition.translator_id) {
      const sourceTranslator = sourceTranslators[edition.translator_id];
      if (!sourceTranslator) {
        errors.push(`[${t.sourcePath}] edition 的 translator_id "${edition.translator_id}" 在 /content/source-translators/ 找不到 uuid 相符的檔案`);
      }
      t.sourceTranslator = sourceTranslator || null;
    } else {
      t.sourceTranslator = null;
    }
  }

  if (errors.length) {
    throw new Error('Build 參照完整性檢查失敗:\n' + errors.map((e) => '  - ' + e).join('\n'));
  }

  return { works, sourceAuthors, sourceTranslators, translators, translations };
}

// ---------- resolve references (zod) ----------

function readFrontmatterForZod(fullPath) {
  return matter(fs.readFileSync(fullPath, 'utf8'), {
    engines: {
      yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }),
    },
  });
}

function loadFlatRegistryForZod(subdir, schema) {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return {};

  const map = {};
  for (const filename of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const fullPath = path.join(dir, filename);
    const parsed = readFrontmatterForZod(fullPath);
    const data = schema.parse(parsed.data);
    map[data.uuid] = data;
  }
  return map;
}

function loadTranslatorsForZod() {
  const translatorsDir = path.join(CONTENT_DIR, 'translators');
  const map = {};
  for (const translatorId of listDirs(translatorsDir)) {
    const descPath = path.join(translatorsDir, translatorId, 'description.md');
    map[translatorId] = fs.existsSync(descPath)
      ? TranslatorSchema.parse(readFrontmatterForZod(descPath).data)
      : null;
  }
  return map;
}

function loadTranslationsForZod() {
  const translatorsDir = path.join(CONTENT_DIR, 'translators');
  const translations = [];

  for (const translatorId of listDirs(translatorsDir)) {
    const translatorDir = path.join(translatorsDir, translatorId);
    const files = fs
      .readdirSync(translatorDir)
      .filter((f) => f.endsWith('.md') && f !== 'description.md');

    for (const filename of files) {
      const fullPath = path.join(translatorDir, filename);
      const parsed = readFrontmatterForZod(fullPath);
      translations.push({
        translatorId,
        frontmatter: TranslationFrontmatterSchema.parse(parsed.data),
        bodyMarkdown: parsed.content || '',
      });
    }
  }
  return translations;
}

function resolveAllForZod() {
  const works = loadFlatRegistryForZod('works', WorkSchema);
  const sourceAuthors = loadFlatRegistryForZod('source-authors', SourceAuthorSchema);
  const sourceTranslators = loadFlatRegistryForZod('source-translators', SourceTranslatorSchema);
  const translators = loadTranslatorsForZod();
  const rawTranslations = loadTranslationsForZod();

  const resolvedWorks = {};
  for (const [uuid, work] of Object.entries(works)) {
    resolvedWorks[uuid] = { ...work, author: sourceAuthors[work.author_id] || null };
  }

  const translations = rawTranslations.map((t) => {
    const work = resolvedWorks[t.frontmatter.work_id] || null;
    const edition = work ? (work.editions || []).find((e) => e.url === t.frontmatter.edition_url) || null : null;
    const sourceTranslator =
      edition && edition.translator_id ? sourceTranslators[edition.translator_id] || null : null;

    return {
      ...t.frontmatter,
      translatorId: t.translatorId,
      bodyMarkdown: t.bodyMarkdown,
      work,
      edition,
      sourceTranslator,
    };
  });

  const worksByAuthor = {};
  for (const work of Object.values(resolvedWorks)) {
    (worksByAuthor[work.author_id] ||= []).push(work);
  }

  const worksBySourceTranslator = {};
  for (const work of Object.values(resolvedWorks)) {
    for (const edition of work.editions || []) {
      if (edition.translator_id) {
        (worksBySourceTranslator[edition.translator_id] ||= []).push(work);
      }
    }
  }

  const translationsByWork = {};
  const translationsByTranslator = {};
  const translationsByTag = {};
  for (const t of translations) {
    (translationsByWork[t.work_id] ||= []).push(t);
    (translationsByTranslator[t.translatorId] ||= []).push(t);
    for (const tag of (t.work && t.work.tags) || []) {
      (translationsByTag[tag] ||= []).push(t);
    }
  }

  return {
    works: resolvedWorks,
    sourceAuthors,
    sourceTranslators,
    translators,
    translations,
    worksByAuthor,
    worksBySourceTranslator,
    translationsByWork,
    translationsByTranslator,
    translationsByTag,
  };
}

// ---------- route (zod) ----------

function routeForZod(graph) {
  const routes = [];

  const latestTranslations = [...graph.translations]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8);

  routes.push({
    url: '/',
    render: renderHomepage,
    data: { latestTranslations, translators: graph.translators, translationsByTranslator: graph.translationsByTranslator },
  });

  routes.push({
    url: '/works/',
    render: renderWorksIndex,
    data: { works: graph.works, translationsByWork: graph.translationsByWork },
  });

  for (const [uuid, work] of Object.entries(graph.works)) {
    routes.push({
      url: `/works/${uuid}/`,
      render: renderWork,
      data: { work, translations: graph.translationsByWork[uuid] || [] },
    });
  }

  for (const t of graph.translations) {
    routes.push({ url: `/translations/${t.uuid}/`, render: renderTranslation, data: t });
  }

  const allTranslatorIds = new Set([...Object.keys(graph.translators), ...Object.keys(graph.translationsByTranslator)]);
  for (const translatorId of allTranslatorIds) {
    routes.push({
      url: `/translators/${translatorId}/`,
      render: renderTranslator,
      data: {
        translatorId,
        profile: graph.translators[translatorId] || null,
        translations: graph.translationsByTranslator[translatorId] || [],
      },
    });
  }

  for (const [uuid, author] of Object.entries(graph.sourceAuthors)) {
    routes.push({
      url: `/source-authors/${uuid}/`,
      render: renderSourceAuthor,
      data: { author, works: graph.worksByAuthor[uuid] || [] },
    });
  }

  for (const [uuid, sourceTranslator] of Object.entries(graph.sourceTranslators)) {
    routes.push({
      url: `/source-translators/${uuid}/`,
      render: renderSourceTranslator,
      data: { sourceTranslator, works: graph.worksBySourceTranslator[uuid] || [] },
    });
  }

  for (const [tag, list] of Object.entries(graph.translationsByTag)) {
    routes.push({ url: `/tags/${tag}/`, render: renderTag, data: { tag, translations: list } });
  }

  routes.push({ url: '/workshop/create-translation/', render: renderWorkshop, data: null });
  routes.push({ url: '/about/', render: renderAbout, data: null });

  return routes;
}

// ---------- build ----------

function build() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const { works, sourceAuthors, sourceTranslators, translators, translations } = resolveAll();

  // group translations by work / translator / tag
  const byWork = {};
  const byTranslator = {};
  const byTag = {};

  for (const t of translations) {
    (byWork[t.frontmatter.work_id] ||= []).push(t);
    (byTranslator[t.translatorId] ||= []).push(t);
    for (const tag of t.work.tags || []) {
      (byTag[tag] ||= []).push(t);
    }
  }

  // ---- /translations/{uuid}/ ----
  for (const t of translations) {
    const authorName = t.author ? pickLocalized(t.author.names) : '(未知作者)';
    const sourceTranslatorName = t.sourceTranslator ? pickLocalized(t.sourceTranslator.names) : null;

    const page = renderTranslation({
      title: t.frontmatter.title,
      workUrl: `/works/${t.work.uuid}/`,
      workTitle: workDisplayTitle(t.work),
      workNativeTitle: pickLocalized(t.work.title, ['ja', 'en', 'romaji', 'zh']),
      translatorId: t.translatorId,
      translatorUrl: `/translators/${t.translatorId}/`,
      authorName,
      authorUrl: `/source-authors/${t.work.author_id}/`,
      date: t.frontmatter.date || null,
      bodyHtml: md.render(t.bodyMarkdown),
      editionUrl: t.frontmatter.edition_url,
      editionPublisher: t.edition.publisher || null,
      editionLanguage: t.edition.language,
      sourceTranslatorName,
      sourceTranslatorUrl: t.sourceTranslator ? `/source-translators/${t.sourceTranslator.uuid}/` : null,
      license: SITE_LICENSE,
      canonical: `/translations/${t.uuid}/`,
    });
    writePage(path.join(OUT_DIR, 'translations', t.uuid, 'index.html'), page);
  }

  // ---- /translations.json ----
  const translationsJson = translations.map((t) => ({
    id: t.uuid,
    title: t.frontmatter.title,
    translator_id: t.translatorId,
    work_id: t.frontmatter.work_id,
    work_title: workDisplayTitle(t.work),
    excerpt: t.frontmatter.excerpt || null,
    date: t.frontmatter.date || null,
    url: `/translations/${t.uuid}/`,
  }));
  ensureDirFor(path.join(OUT_DIR, 'translations.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'translations.json'), JSON.stringify(translationsJson, null, 2), 'utf8');

  // ---- /works.json、/source-authors.json(給 /workshop/ 表單搜尋既有項目用,見架構規格.md)----
  const worksJson = Object.entries(works).map(([uuid, w]) => ({
    uuid,
    title: workDisplayTitle(w),
    authorName: sourceAuthors[w.author_id] ? pickLocalized(sourceAuthors[w.author_id].names) : null,
    wikidataId: w.wikidata_id || null,
    editions: (w.editions || []).map((e) => ({
      url: e.url,
      language: e.language,
      publisher: e.publisher || null,
    })),
  }));
  ensureDirFor(path.join(OUT_DIR, 'works.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'works.json'), JSON.stringify(worksJson, null, 2), 'utf8');

  const sourceAuthorsJson = Object.entries(sourceAuthors).map(([uuid, a]) => ({
    uuid,
    name: pickLocalized(a.names),
    wikidataId: a.wikidata_id || null,
    sourceUrl: a.source_url || null,
  }));
  ensureDirFor(path.join(OUT_DIR, 'source-authors.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'source-authors.json'), JSON.stringify(sourceAuthorsJson, null, 2), 'utf8');

  // ---- /works/{uuid}/ ----
  for (const [workUuid, work] of Object.entries(works)) {
    const author = sourceAuthors[work.author_id];
    const authorName = author ? pickLocalized(author.names) : '(未知作者)';

    const page = renderWork({
      title: workDisplayTitle(work),
      nativeTitle: pickLocalized(work.title, ['ja', 'en', 'romaji', 'zh']),
      authorName,
      authorUrl: `/source-authors/${work.author_id}/`,
      originalLanguage: work.original_language,
      category: work.category || null,
      tags: (work.tags || []).map((tg) => ({ name: tg, url: `/tags/${tg}/` })),
      editions: (work.editions || []).map((e) => ({
        language: e.language,
        url: e.url,
        publisher: e.publisher || null,
        date: e.date || null,
        copyrightStatus: e.copyright_status,
      })),
      translations: (byWork[workUuid] || []).map((t) => ({
        url: `/translations/${t.uuid}/`,
        title: t.frontmatter.title,
        translatorId: t.translatorId,
        translatorUrl: `/translators/${t.translatorId}/`,
        editionUrl: t.frontmatter.edition_url,
        editionLanguage: t.edition ? t.edition.language : '?',
        sourceTranslatorName: t.sourceTranslator ? pickLocalized(t.sourceTranslator.names) : null,
        sourceTranslatorUrl: t.sourceTranslator ? `/source-translators/${t.sourceTranslator.uuid}/` : null,
        excerpt: t.frontmatter.excerpt || null,
      })),
      canonical: `/works/${workUuid}/`,
    });
    writePage(path.join(OUT_DIR, 'works', workUuid, 'index.html'), page);
  }

  // ---- /works/(全作品列表頁,work-level:一部作品一張卡,不分譯本) ----
  const worksIndexEntries = Object.entries(works).map(([workUuid, w]) => {
    const author = sourceAuthors[w.author_id];
    const workTranslations = byWork[workUuid] || [];
    const translatorIds = [...new Set(workTranslations.map((t) => t.translatorId))];
    return {
      url: `/works/${workUuid}/`,
      workTitle: workDisplayTitle(w),
      workNativeTitle: pickLocalized(w.title, ['ja', 'en', 'romaji', 'zh']),
      authorName: author ? pickLocalized(author.names) : '(未知作者)',
      tags: w.tags || [],
      category: w.category || null,
      originalLanguage: w.original_language,
      translatorIds,
      translationCount: workTranslations.length,
      excerpt: w.excerpt || null,
    };
  });

  const worksIndexPage = renderWorksIndex({
    entries: worksIndexEntries,
    categories: [...new Set(Object.values(works).map((w) => w.category).filter(Boolean))].sort(),
    languages: [...new Set(Object.values(works).map((w) => w.original_language).filter(Boolean))].sort(),
    tags: Object.keys(byTag).sort(),
  });
  writePage(path.join(OUT_DIR, 'works', 'index.html'), worksIndexPage);

  // ---- /translators/{id}/ ----
  const allTranslatorIds = new Set([...Object.keys(translators), ...Object.keys(byTranslator)]);
  for (const translatorId of allTranslatorIds) {
    const profile = translators[translatorId] || {};
    const translatorCharCount = (byTranslator[translatorId] || []).reduce((sum, t) => sum + t.charCount, 0);

    const page = renderTranslator({
      displayName: profile.display_name || translatorId,
      bio: profile.bio || null,
      charCountDisplay: formatCharCount(translatorCharCount),
      translations: (byTranslator[translatorId] || []).map((t) => ({
        url: `/translations/${t.uuid}/`,
        title: t.frontmatter.title,
        workTitle: pickLocalized(t.work.title, ['ja', 'en', 'romaji', 'zh']),
        excerpt: t.frontmatter.excerpt || null,
      })),
      canonical: `/translators/${translatorId}/`,
    });
    writePage(path.join(OUT_DIR, 'translators', translatorId, 'index.html'), page);
  }

  // ---- /source-authors/{uuid}/ ----
  for (const [authorUuid, author] of Object.entries(sourceAuthors)) {
    const worksOfAuthor = Object.entries(works).filter(([, w]) => w.author_id === authorUuid);

    const page = renderSourceAuthor({
      name: pickLocalized(author.names),
      works: worksOfAuthor.map(([wUuid, w]) => ({
        url: `/works/${wUuid}/`,
        title: workDisplayTitle(w),
        nativeTitle: pickLocalized(w.title, ['ja', 'en', 'romaji', 'zh']),
        translationCount: (byWork[wUuid] || []).length,
      })),
      canonical: `/source-authors/${authorUuid}/`,
    });
    writePage(path.join(OUT_DIR, 'source-authors', authorUuid, 'index.html'), page);
  }

  // ---- /source-translators/{uuid}/ ----
  for (const [stUuid, st] of Object.entries(sourceTranslators)) {
    const relatedWorks = Object.entries(works).filter(([, w]) =>
      (w.editions || []).some((e) => e.translator_id === stUuid)
    );

    const page = renderSourceTranslator({
      name: pickLocalized(st.names),
      language: st.language,
      works: relatedWorks.map(([wUuid, w]) => ({ url: `/works/${wUuid}/`, title: workDisplayTitle(w) })),
      canonical: `/source-translators/${stUuid}/`,
    });
    writePage(path.join(OUT_DIR, 'source-translators', stUuid, 'index.html'), page);
  }

  // ---- /tags/{tag}/ ----
  for (const [tag, list] of Object.entries(byTag)) {
    const page = renderTag({
      tag,
      translations: list.map((t) => ({
        url: `/translations/${t.uuid}/`,
        title: t.frontmatter.title,
        workTitle: workDisplayTitle(t.work),
        translatorId: t.translatorId,
        translatorUrl: `/translators/${t.translatorId}/`,
      })),
      canonical: `/tags/${tag}/`,
    });
    writePage(path.join(OUT_DIR, 'tags', tag, 'index.html'), page);
  }

  // ---- / (首頁:最新譯作 + 譯者一覽) ----
  const latestTranslations = translations
    .slice()
    .sort((a, b) => String(b.frontmatter.date || '').localeCompare(String(a.frontmatter.date || '')))
    .slice(0, 8)
    .map((t) => ({
      url: `/translations/${t.uuid}/`,
      title: t.frontmatter.title,
      translatorId: t.translatorId,
      authorName: t.author ? pickLocalized(t.author.names) : '(未知作者)',
      date: t.frontmatter.date || null,
      workNativeTitle: pickLocalized(t.work.title, ['ja', 'en', 'romaji', 'zh']),
    }));

  const translatorList = Object.keys(byTranslator).map((translatorId) => {
    const profile = translators[translatorId] || {};
    return {
      url: `/translators/${translatorId}/`,
      displayName: profile.display_name || translatorId,
      bio: profile.bio || null,
      count: byTranslator[translatorId].length,
      charCountDisplay: formatCharCount(byTranslator[translatorId].reduce((sum, t) => sum + t.charCount, 0)),
    };
  });

  const homePage = renderHomepage({ latestTranslations, translatorList });
  writePage(path.join(OUT_DIR, 'index.html'), homePage);

  // ---- /workshop/create-translation/ ----
  writePage(path.join(OUT_DIR, 'workshop', 'create-translation', 'index.html'), renderWorkshop());

  // ---- /about/ ----
  writePage(path.join(OUT_DIR, 'about', 'index.html'), renderAbout());

  // ---- 複製 assets/ 靜態資源(CSS/JS)到 dist/assets/ ----
  if (fs.existsSync(ASSETS_DIR)) {
    fs.cpSync(ASSETS_DIR, path.join(OUT_DIR, 'assets'), { recursive: true });
  }

  // ---- 複製 favicon.ico 到 dist/ 根目錄(跟 index.html 並排,瀏覽器預設抓 /favicon.ico)----
  const FAVICON_PATH = path.join(ASSETS_DIR, 'images', 'favicon.ico');
  if (fs.existsSync(FAVICON_PATH)) {
    fs.copyFileSync(FAVICON_PATH, path.join(OUT_DIR, 'favicon.ico'));
  }

  return {
    translations: translations.length,
    works: Object.keys(works).length,
    sourceAuthors: Object.keys(sourceAuthors).length,
    sourceTranslators: Object.keys(sourceTranslators).length,
    translators: allTranslatorIds.size,
    tags: Object.keys(byTag).length,
  };
}

if (require.main === module) {
  try {
    const stats = build();
    console.log('Build 成功:', JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { build, resolveAllForZod, routeForZod };
