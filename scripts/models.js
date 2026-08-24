'use strict';

// 內容庫 schema。date 欄位一律是 z.string()(YYYY-MM-DD),不是 z.date()——
// build.js 讀取 frontmatter 時已把 yaml engine 換成 yaml.JSON_SCHEMA,日期
// 全程只會是字串。

const { z } = require('zod');
const { SUPPORTED_LANGUAGES, AOZORA_WORK_URL_RE, GUTENBERG_WORK_URL_RE } = require('./constants');

// ---------- 共用子結構 ----------

// 多語言文字，一個dictionary，key是語言代號，value是該語言的翻譯
// 如：title:{ja:"走れメロス",zh-TW:"跑吧！梅洛斯"}
// 如：name:{ja:"キリスト",zh-TW:"耶穌"}
const LocalizedStringSchema = z
  .record(z.string())
  .refine((obj) => Object.keys(obj).length > 0, { message: '至少要有一種語言的文字' });

// 底本——遞迴結構,parent 型別跟自己一樣(底本的親本)。input_version/
// proofread_version(入力に使用/校正に使用)不拆版・刷・日期成獨立欄位,
// 版+刷合起來就是更精確的版本描述,直接存一整句自由文字(如「初版第1刷
// 1999年3月25日」),跟來源站本來的呈現方式一致,不強行結構化低使用頻率的資訊。
const SourceTextSchema = z.lazy(() =>
  z
    .object({
      title: z.string(),
      publisher: z.string(),
      first_version_date: z.string(),
      input_version: z.string().optional(),
      proofread_version: z.string().optional(),
      parent: SourceTextSchema.optional(),
    })
    .strict()
);

// 初出——作品史實,書目層級,跟 SourceText 不同型別(沒有 printing/parent)
const FirstPublishedSchema = z
  .object({
    title: z.string(),
    publisher: z.string().optional(),
    date: z.string(),
  })
  .strict();

// ---------- editions ----------

const EditionSchema = z
  .object({
    url: z
      .string()
      .refine((url) => AOZORA_WORK_URL_RE.test(url) || GUTENBERG_WORK_URL_RE.test(url), {
        message: '不是目前支援的來源格式(僅接受青空文庫、古騰堡計畫的作品資訊頁/本文頁連結)',
      }),
    language: z.enum(SUPPORTED_LANGUAGES),
    copyright_status: z.string(),
    translator_id: z.string().uuid().nullable(),
    // publisher/date 不獨立存在——顯示時改讀 base_text.publisher / base_text.first_version_date,
    // 避免跟底本資訊重複記錄、兩邊對不上
    base_text: SourceTextSchema.optional(),
  })
  .strict();

// ---------- content/works/{uuid}.md ----------

const WorkSchema = z
  .object({
    uuid: z.string().uuid(),
    title: LocalizedStringSchema,
    author_id: z.string().uuid(),
    original_language: z.enum(SUPPORTED_LANGUAGES),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    excerpt: z.string().optional(),
    wikidata_id: z.string().optional(),
    first_published: FirstPublishedSchema.optional(),
    editions: z.array(EditionSchema),
  })
  .strict();

// ---------- content/source-authors/{uuid}.md ----------

const SourceAuthorSchema = z
  .object({
    uuid: z.string().uuid(),
    names: LocalizedStringSchema,
    wikidata_id: z.string().optional(),
    url: z.string().url().optional(),
    birth_date: z.string().optional(),
    death_date: z.string().optional(),
    excerpt: z.string().optional(),
  })
  .strict();

// ---------- content/source-translators/{uuid}.md ----------

const SourceTranslatorSchema = z
  .object({
    uuid: z.string().uuid(),
    names: LocalizedStringSchema,
    language: z.enum(SUPPORTED_LANGUAGES),
    wikidata_id: z.string().optional(),
    url: z.string().url().optional(),
  })
  .strict();

// ---------- content/translators/{id}/description.md ----------

const TranslatorSchema = z
  .object({
    display_name: z.string(),
    bio: z.string().optional(),
    links: z.array(z.string().url()).optional(),
  })
  .strict();

// ---------- content/translators/{id}/*.md(單篇譯文 frontmatter,description.md 除外)----------
// 只驗證 gray-matter 的 parsed.data(YAML 區塊);正文(parsed.content)不是
// 結構化資料,不屬於這個 schema 的範圍,故意用 Frontmatter 字樣跟別的型別
// 區隔開來。

const TranslationFrontmatterSchema = z
  .object({
    uuid: z.string().uuid(),
    title: z.string(),
    work_id: z.string().uuid(),
    edition_url: z.string(),
    language: z.enum(SUPPORTED_LANGUAGES),
    date: z.string().optional(),
    excerpt: z.string().optional(),
  })
  .strict();

module.exports = {
  LocalizedStringSchema,
  SourceTextSchema,
  FirstPublishedSchema,
  EditionSchema,
  WorkSchema,
  SourceAuthorSchema,
  SourceTranslatorSchema,
  TranslatorSchema,
  TranslationFrontmatterSchema,
};
