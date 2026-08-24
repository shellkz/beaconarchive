'use strict';

const cheerio = require('cheerio');

function tableToMap($, table) {
  const map = {};
  $(table)
    .find('tr')
    .each((_, tr) => {
      const $tds = $(tr).children('td');
      if ($tds.length < 2) return;
      const label = $tds.eq(0).text().replace(/[：:]\s*$/, '').trim();
      if (label) map[label] = $tds.eq(1);
    });
  return map;
}

function cleanText($, $cell) {
  if (!$cell) return null;
  const $clone = $cell.clone();
  // 青空文庫慣例:人物について/備考 這類欄位常在正文後面接一個 <br> 再放
  // 維基百科連結當引用,連結本身不是內容的一部分,連同它前面的 <br> 一起砍掉,
  // 不要只移除 <a>/<img> 卻留下包著它的「」符號。
  const brIndex = $clone.html() ? $clone.html().search(/<br\s*\/?>/i) : -1;
  if (brIndex !== -1) {
    $clone.html($clone.html().slice(0, brIndex));
  }
  $clone.find('a, img, script, div#link').remove();
  const text = $clone.text().replace(/\s+/g, ' ').trim();
  return text || null;
}

function parseSourceText($, table) {
  if (!table.length) return null;
  const map = tableToMap($, table);
  const title = cleanText($, map['底本'] || map['底本の親本']);
  const publisher = cleanText($, map['出版社']);
  const firstVersionDate = cleanText($, map['初版発行日']);
  if (!title || !publisher || !firstVersionDate) return null;

  const result = {
    title,
    publisher,
    first_version_date: firstVersionDate,
  };
  const inputVersion = cleanText($, map['入力に使用']);
  if (inputVersion) result.input_version = inputVersion;
  const proofreadVersion = cleanText($, map['校正に使用']);
  if (proofreadVersion) result.proofread_version = proofreadVersion;

  return result;
}

function parseAozoraWork(url, html) {
  const $ = cheerio.load(html);

  const titleTable = tableToMap($, $('table[summary="タイトルデータ"]'));
  const workTable = tableToMap($, $('table[summary="作品データ"]'));
  const authorTable = tableToMap($, $('table[summary="作家データ"]'));
  const baseTextTable = $('table[summary="底本データ"]');
  const parentTextTable = $('table[summary="親本データ"]');

  const workTitle = cleanText($, titleTable['作品名']);

  const authorLink = authorTable['作家名'] ? authorTable['作家名'].find('a').first() : null;
  const authorName = authorLink && authorLink.length ? authorLink.text().trim() : cleanText($, authorTable['作家名']);
  const authorUrl = authorLink && authorLink.length ? new URL(authorLink.attr('href'), url).toString() : null;

  const firstPublishedRaw = cleanText($, workTable['初出']);
  let firstPublished = null;
  if (firstPublishedRaw) {
    const match = firstPublishedRaw.match(/^「(.+?)」\s*(.*)$/);
    firstPublished = match ? { title: match[1], date: match[2] || null } : { title: firstPublishedRaw, date: null };
  }

  const baseText = parseSourceText($, baseTextTable);
  if (baseText) {
    const parent = parseSourceText($, parentTextTable);
    if (parent) baseText.parent = parent;
  }

  return {
    work: {
      title: workTitle,
      categoryHint: cleanText($, workTable['分類']),
    },
    firstPublished,
    author: {
      name: authorName,
      url: authorUrl,
      romaji: cleanText($, authorTable['ローマ字表記']),
      birth_date: cleanText($, authorTable['生年']),
      death_date: cleanText($, authorTable['没年']),
      excerpt: cleanText($, authorTable['人物について']),
    },
    edition: {
      url,
      language: 'ja',
      copyright_status: '日本公版',
      base_text: baseText,
    },
  };
}

module.exports = { parseAozoraWork };
