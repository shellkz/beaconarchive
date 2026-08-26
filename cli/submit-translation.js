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
  return romaji.toLowerCase().replace(/,/g, '').trim().replace(/\s+/g, '-');
}

function readFrontmatter(fullPath) {
  return matter(fs.readFileSync(fullPath, 'utf8'), {
    engines: { yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) },
  });
}

function writeFrontmatter(fullPath, data, body = '') {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, matter.stringify(body, data), 'utf8');
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

function extractWikidataId(url) {
  if (!url) return undefined;
  const m = url.match(/Q\d+/);
  return m ? m[0] : undefined;
}

async function fetchCandidate(sourceUrl) {
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  return parseAozoraWork(sourceUrl, html);
}

async function submitTranslation(payload) {
  const required = ['translatorId', 'sourceUrl', 'workTitleZh', 'bodyMarkdown'];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) {
    throw new Error(`payload 缺少必填欄位:${missing.join(', ')}`);
  }

  const parsed = await fetchCandidate(payload.sourceUrl);
  const graph = resolveAll();

  const editionUrl = parsed.edition.url;
  const existingWork = findBySiteId(editionUrl, Object.values(graph.works), (w) =>
    (w.editions || []).map((e) => e.url)
  );
  const existingAuthor = existingWork
    ? existingWork.author
    : findBySiteId(parsed.author.url, Object.values(graph.sourceAuthors), (a) => (a.url ? [a.url] : []));

  // ---- author ----
  let authorId;
  if (existingAuthor) {
    authorId = existingAuthor.uuid;
    const authorPath = path.join(ROOT, existingAuthor.sourcePath);
    const raw = readFrontmatter(authorPath);
    let changed = false;
    if (!raw.data.names['zh-TW'] && payload.authorNameZh) {
      raw.data.names = { ...raw.data.names, 'zh-TW': payload.authorNameZh };
      changed = true;
    }
    if (!raw.data.excerpt && payload.authorExcerpt) {
      raw.data.excerpt = payload.authorExcerpt;
      changed = true;
    }
    if (!raw.data.wikidata_id && payload.authorWikidataUrl) {
      raw.data.wikidata_id = extractWikidataId(payload.authorWikidataUrl);
      changed = true;
    }
    if (changed) {
      SourceAuthorSchema.parse(raw.data);
      fs.writeFileSync(authorPath, matter.stringify(raw.content, raw.data), 'utf8');
    }
  } else {
    authorId = crypto.randomUUID();
    const authorExcerptValue = payload.authorExcerpt || parsed.author.excerpt;
    const authorWikidataId = extractWikidataId(payload.authorWikidataUrl);
    const authorData = SourceAuthorSchema.parse({
      uuid: authorId,
      names: {
        ja: parsed.author.name,
        ...(parsed.author.romaji ? { romaji: parsed.author.romaji } : {}),
        ...(payload.authorNameZh ? { 'zh-TW': payload.authorNameZh } : {}),
      },
      url: parsed.author.url,
      ...(parsed.author.birth_date ? { birth_date: parsed.author.birth_date } : {}),
      ...(parsed.author.death_date ? { death_date: parsed.author.death_date } : {}),
      ...(authorExcerptValue ? { excerpt: authorExcerptValue } : {}),
      ...(authorWikidataId ? { wikidata_id: authorWikidataId } : {}),
    });
    const authorPath = path.join(
      CONTENT_DIR,
      'source-authors',
      `${slugifyRomaji(authorData.names.romaji || authorData.names.ja)}.md`
    );
    writeFrontmatter(authorPath, authorData);
  }

  // ---- work ----
  const editionCandidate = {
    url: parsed.edition.url,
    language: parsed.edition.language,
    copyright_status: parsed.edition.copyright_status,
    translator_id: null,
    ...(parsed.edition.base_text ? { base_text: parsed.edition.base_text } : {}),
  };

  let workId;
  if (existingWork) {
    workId = existingWork.uuid;
    const workPath = path.join(ROOT, existingWork.sourcePath);
    const raw = readFrontmatter(workPath);
    let changed = false;
    if (!raw.data.title['zh-TW']) {
      raw.data.title = { ...raw.data.title, 'zh-TW': payload.workTitleZh };
      changed = true;
    }
    if (!raw.data.excerpt && payload.workExcerpt) {
      raw.data.excerpt = payload.workExcerpt;
      changed = true;
    }
    if (!raw.data.wikidata_id && payload.workWikidataUrl) {
      raw.data.wikidata_id = extractWikidataId(payload.workWikidataUrl);
      changed = true;
    }
    const editionExists = (raw.data.editions || []).some(
      (e) => extractSiteId(e.url) === extractSiteId(editionUrl)
    );
    if (!editionExists) {
      raw.data.editions = [...(raw.data.editions || []), editionCandidate];
      changed = true;
    }
    if (changed) {
      WorkSchema.parse(raw.data);
      fs.writeFileSync(workPath, matter.stringify(raw.content, raw.data), 'utf8');
    }
  } else {
    workId = crypto.randomUUID();
    const workWikidataId = extractWikidataId(payload.workWikidataUrl);
    const workData = WorkSchema.parse({
      uuid: workId,
      title: { ja: parsed.work.title, 'zh-TW': payload.workTitleZh },
      author_id: authorId,
      original_language: 'ja',
      ...(payload.workExcerpt ? { excerpt: payload.workExcerpt } : {}),
      ...(workWikidataId ? { wikidata_id: workWikidataId } : {}),
      ...(parsed.firstPublished && parsed.firstPublished.date
        ? { first_published: { title: parsed.firstPublished.title, date: parsed.firstPublished.date } }
        : {}),
      editions: [editionCandidate],
    });
    const workPath = path.join(CONTENT_DIR, 'works', `${sanitizeFilename(parsed.work.title)}.md`);
    writeFrontmatter(workPath, workData);
  }

  // ---- translation(永遠直接採用 payload,不留空白 stub) ----
  const translationData = TranslationFrontmatterSchema.parse({
    uuid: crypto.randomUUID(),
    title: payload.workTitleZh,
    work_id: workId,
    edition_url: editionUrl,
    language: 'zh-TW',
    date: new Date().toISOString().slice(0, 10),
    ...(payload.translationExcerpt ? { excerpt: payload.translationExcerpt } : {}),
  });
  const translationPath = path.join(
    CONTENT_DIR,
    'translators',
    payload.translatorId,
    `${sanitizeFilename(parsed.work.title)}.md`
  );
  writeFrontmatter(translationPath, translationData, payload.bodyMarkdown);

  console.log(`完成:${path.relative(ROOT, translationPath)}`);
  return { workId, authorId, translationPath };
}

async function main() {
  // CI 走環境變數(避免把外部輸入直接拼進 shell 指令字串);本機手動測試
  // 保留吃 argv 當備援,兩種都支援。
  const raw = process.env.PAYLOAD || process.argv[2];
  if (!raw) {
    console.error("用法:node cli/submit-translation.js '<json payload>'(或設定 PAYLOAD 環境變數)");
    process.exit(1);
  }
  const payload = JSON.parse(raw);
  try {
    await submitTranslation(payload);
  } catch (err) {
    console.error('失敗:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { submitTranslation };
