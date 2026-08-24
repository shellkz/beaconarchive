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
const { renderLayout, pickLocalized, workDisplayTitle } = require('./app/layout');
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

// ---------- small helpers ----------

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeHtml(outPath, html) {
  ensureDirFor(outPath);
  fs.writeFileSync(outPath, html, 'utf8');
}

// 譯者貢獻字數統計:只算正文(不含標題/摘要等其他欄位),流程是 markdown
// 轉 HTML → 剝掉 HTML 標籤 → 還原 markdown-it 會跳脫的幾個標準 HTML 實體 →
// 去除空白類字元(含全形空白,JS 的 \s 不會吃到)→ 數剩下字串的長度。
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

function formatZodError(err) {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

// ---------- 跨檔重複偵測(硬性擋下,不是只警告)見架構規格.md 第 6 節 ----------

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

// works 用 editions[].url(可能多筆),source-authors/source-translators 用 url(單一)
function collectCandidateUrls(entry) {
  if (Array.isArray(entry.editions)) return entry.editions.map((e) => e.url);
  if (entry.url) return [entry.url];
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

// ---------- 讀取 content/ ----------

function readFrontmatter(fullPath) {
  return matter(fs.readFileSync(fullPath, 'utf8'), {
    engines: {
      yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }),
    },
  });
}

// works / source-authors / source-translators:單一檔案,不是資料夾,
// 真正的識別碼是檔案內容裡的 uuid 欄位,檔名只是給人看的可讀前綴——見架構規格.md 第 1、2 節。
function loadFlatRegistry(subdir, schema, categoryLabel) {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return {};

  const map = {};
  const errors = [];

  for (const filename of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const fullPath = path.join(dir, filename);
    const sourcePath = path.relative(ROOT, fullPath);
    const parsed = readFrontmatter(fullPath);

    let data;
    try {
      data = schema.parse(parsed.data);
    } catch (err) {
      errors.push(`[${sourcePath}] ${formatZodError(err)}`);
      continue;
    }

    if (map[data.uuid]) {
      errors.push(`[${sourcePath}] uuid "${data.uuid}" 與 [${map[data.uuid].sourcePath}] 重複,同一類別內 uuid 不得重複`);
      continue;
    }

    map[data.uuid] = { ...data, sourcePath };
  }

  if (errors.length) {
    throw new Error(`${categoryLabel} 驗證失敗:\n` + errors.map((e) => '  - ' + e).join('\n'));
  }

  return map;
}

// translators/ 是唯一維持資料夾的類別(自身 profile + 多篇譯文的容器),
// 資料夾名稱本身就是識別碼。沒有 description.md 就代表這個譯者還沒寫 profile,存 null。
function loadTranslators() {
  const translatorsDir = path.join(CONTENT_DIR, 'translators');
  const map = {};
  const errors = [];

  for (const translatorId of listDirs(translatorsDir)) {
    const descPath = path.join(translatorsDir, translatorId, 'description.md');
    if (!fs.existsSync(descPath)) {
      map[translatorId] = null;
      continue;
    }
    try {
      map[translatorId] = TranslatorSchema.parse(readFrontmatter(descPath).data);
    } catch (err) {
      errors.push(`[${path.relative(ROOT, descPath)}] ${formatZodError(err)}`);
    }
  }

  if (errors.length) {
    throw new Error('譯者 profile 驗證失敗:\n' + errors.map((e) => '  - ' + e).join('\n'));
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
      const parsed = readFrontmatter(fullPath);

      let frontmatter;
      try {
        frontmatter = TranslationFrontmatterSchema.parse(parsed.data);
      } catch (err) {
        errors.push(`[${sourcePath}] ${formatZodError(err)}`);
        continue;
      }

      if (seenUuids.has(frontmatter.uuid)) {
        errors.push(`[${sourcePath}] uuid "${frontmatter.uuid}" 與 [${seenUuids.get(frontmatter.uuid)}] 重複,全站譯文 uuid 不得重複`);
        continue;
      }
      seenUuids.set(frontmatter.uuid, sourcePath);

      translations.push({
        translatorId,
        frontmatter,
        bodyMarkdown: parsed.content || '',
        charCount: countProseChars(parsed.content || ''),
        sourcePath,
      });
    }
  }

  if (errors.length) {
    throw new Error('譯文驗證失敗:\n' + errors.map((e) => '  - ' + e).join('\n'));
  }

  return translations;
}

// ---------- resolve ----------

function resolveAll() {
  const works = loadFlatRegistry('works', WorkSchema, 'works/');
  const sourceAuthors = loadFlatRegistry('source-authors', SourceAuthorSchema, 'source-authors/');
  const sourceTranslators = loadFlatRegistry('source-translators', SourceTranslatorSchema, 'source-translators/');
  const translators = loadTranslators();
  const rawTranslations = loadTranslations();

  const errors = [
    ...detectDuplicates(works, 'works'),
    ...detectDuplicates(sourceAuthors, 'source-authors'),
    ...detectDuplicates(sourceTranslators, 'source-translators'),
  ];

  const resolvedWorks = {};
  for (const [uuid, work] of Object.entries(works)) {
    const author = sourceAuthors[work.author_id];
    if (!author) {
      errors.push(`[${work.sourcePath}] author_id "${work.author_id}" 在 /content/source-authors/ 找不到 uuid 相符的檔案`);
    }
    resolvedWorks[uuid] = { ...work, author: author || null };
  }

  const translations = rawTranslations.map((t) => {
    const fm = t.frontmatter;
    const work = resolvedWorks[fm.work_id];
    if (!work) {
      errors.push(`[${t.sourcePath}] work_id "${fm.work_id}" 在 /content/works/ 找不到 uuid 相符的檔案`);
    }

    const edition = work ? (work.editions || []).find((e) => e.url === fm.edition_url) : null;
    if (work && !edition) {
      errors.push(`[${t.sourcePath}] edition_url "${fm.edition_url}" 在作品 "${work.sourcePath}" 的 editions 清單裡找不到相符項目`);
    }

    let sourceTranslator = null;
    if (edition && edition.translator_id) {
      sourceTranslator = sourceTranslators[edition.translator_id];
      if (!sourceTranslator) {
        errors.push(`[${t.sourcePath}] edition 的 translator_id "${edition.translator_id}" 在 /content/source-translators/ 找不到 uuid 相符的檔案`);
      }
    }

    return {
      ...fm,
      translatorId: t.translatorId,
      bodyMarkdown: t.bodyMarkdown,
      charCount: t.charCount,
      sourcePath: t.sourcePath,
      work: work || null,
      edition: edition || null,
      sourceTranslator: sourceTranslator || null,
    };
  });

  if (errors.length) {
    throw new Error('Build 參照完整性檢查失敗:\n' + errors.map((e) => '  - ' + e).join('\n'));
  }

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

// ---------- route ----------

function route(graph) {
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
      data: { author, works: graph.worksByAuthor[uuid] || [], translationsByWork: graph.translationsByWork },
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

  const graph = resolveAll();
  const routes = route(graph);

  for (const { url, render, data } of routes) {
    writeHtml(path.join(OUT_DIR, url, 'index.html'), renderLayout(render(data)));
  }

  // ---- /translations.json ----
  const translationsJson = graph.translations.map((t) => ({
    id: t.uuid,
    title: t.title,
    translator_id: t.translatorId,
    work_id: t.work_id,
    work_title: workDisplayTitle(t.work),
    excerpt: t.excerpt || null,
    date: t.date || null,
    url: `/translations/${t.uuid}/`,
  }));
  ensureDirFor(path.join(OUT_DIR, 'translations.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'translations.json'), JSON.stringify(translationsJson, null, 2), 'utf8');

  // ---- /works.json、/source-authors.json(給 /workshop/ 表單搜尋既有項目用,見架構規格.md)----
  const worksJson = Object.values(graph.works).map((w) => ({
    uuid: w.uuid,
    title: workDisplayTitle(w),
    authorName: w.author ? pickLocalized(w.author.names) : null,
    wikidataId: w.wikidata_id || null,
    editions: (w.editions || []).map((e) => ({
      url: e.url,
      language: e.language,
      publisher: e.base_text ? e.base_text.publisher : null,
    })),
  }));
  ensureDirFor(path.join(OUT_DIR, 'works.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'works.json'), JSON.stringify(worksJson, null, 2), 'utf8');

  const sourceAuthorsJson = Object.values(graph.sourceAuthors).map((a) => ({
    uuid: a.uuid,
    name: pickLocalized(a.names),
    wikidataId: a.wikidata_id || null,
    sourceUrl: a.url || null,
  }));
  ensureDirFor(path.join(OUT_DIR, 'source-authors.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'source-authors.json'), JSON.stringify(sourceAuthorsJson, null, 2), 'utf8');

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
    translations: graph.translations.length,
    works: Object.keys(graph.works).length,
    sourceAuthors: Object.keys(graph.sourceAuthors).length,
    sourceTranslators: Object.keys(graph.sourceTranslators).length,
    translators: new Set([...Object.keys(graph.translators), ...Object.keys(graph.translationsByTranslator)]).size,
    tags: Object.keys(graph.translationsByTag).length,
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

module.exports = { build, resolveAll, route, extractSiteId, detectDuplicates };
