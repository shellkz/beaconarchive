'use strict';

// 跨檔案共用的驗證常數。目前 build.js / workshop.js 各自維護一份同樣的規則,
// 之後遷移時逐步改成從這裡 import,現階段先集中定義,不強制其他檔案立刻跟進。

const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-TW'];

const AOZORA_WORK_URL_RE = /^https:\/\/www\.aozora\.gr\.jp\/cards\/\d+\/(?:card\d+\.html|files\/\d+_\d+\.html)$/;
const GUTENBERG_WORK_URL_RE = /^https:\/\/www\.gutenberg\.org\/(?:ebooks\/\d+\/?|cache\/epub\/\d+\/.+)$/;

module.exports = {
  SUPPORTED_LANGUAGES,
  AOZORA_WORK_URL_RE,
  GUTENBERG_WORK_URL_RE,
};
