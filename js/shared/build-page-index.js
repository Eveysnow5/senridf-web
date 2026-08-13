// 页面索引：`pageTexts[]` → 一份"每页大概讲什么"的清单，交给模型，让它自己说
// "给我第 86 页和利润表所在页"，而不是由 IDF 启发式提前替它猜。
// 多轮取页的第 1 块积木，见 docs/plans/2026-08-12-analysis-multiround-plan.md。
//
// 为什么索引很便宜：pageTexts 全 148 页本来就抽好了（解析 PDF 时顺手存的），每页只
// 取页码 + 开头约 80 字，一次发全约 12KB。相比之下"猜错页"的代价是整份文件的图像
// 预算白费——2026-08-12 实跑就发生了：2025 年报被选中的是第 32 页（联接产业）和
// 第 82 页（会计政策），两页都不含「其他净收支」，那份文件的额度全废，模型只能答
// "所提供的片段中查不到"。
//
// 印刷页码为什么必须一起给
// 同一次实跑，模型引的是「第86页」——那是我们给它的 PDF 页序（pdf.getPage(n) 的 n），
// 而年报那一页自己印的页码是 84（封面+扉页的偏移）。作者拿 86 去年报里核，翻到的
// 不是那张表。「每条引文带页码」这条纪律的全部意义就是让人能核，两套页码对不上，
// 纪律就打了折。
// 但印刷页码是**认出来的**，不是给定的 —— 所以宁可没有也不能给错的：认不准就整份
// 退回只给 PDF 页序（见 detectPrintedPages 的连号判据）。

import { normalizeCjkSpacing } from './select-relevant-passages.js';

/** 页眉里的印刷页码有两种形态：靠左「84 华为投资控股有限公司…」、靠右「2024年年度报告\n 89」。 */
function readPrintedNumber(pageText) {
  const head = String(pageText || '')
    .slice(0, 60)
    .replace(/\r/g, '');
  let m = head.match(/^\s*(\d{1,4})\s+[一-龥]/);
  if (m) return Number(m[1]);
  m = head.match(/^[^\n]*\n\s*(\d{1,4})\b/);
  if (m) return Number(m[1]);
  return null;
}

/**
 * 认出每页的印刷页码，并判断这份识别可不可信。
 *
 * 判据是**连号率**，不是识别率：页眉页码天然连续，认对了必然连号；认错了（把表格里
 * 的数字、年份、金额当成页码）几乎不可能连号。这让这个启发式自带校验——不需要外部
 * 真值就能知道自己靠不靠谱。真实年报夹具实测 40/40 识别、39/39 连号。
 *
 * @param {string[]} pageTexts
 * @returns {{numbers:(number|null)[], trustworthy:boolean}}
 */
export function detectPrintedPages(pageTexts) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [];
  const numbers = pages.map(readPrintedNumber);
  const found = numbers.filter((v) => v !== null).length;

  let pairs = 0;
  let consecutive = 0;
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === null || numbers[i - 1] === null) continue;
    pairs++;
    if (numbers[i] - numbers[i - 1] === 1) consecutive++;
  }

  // 单页无从判断连号，一律当不可信：宁可不给。
  const trustworthy =
    pages.length >= 2 && found / pages.length >= 0.6 && pairs > 0 && consecutive / pairs >= 0.8;
  return { numbers, trustworthy };
}

/**
 * @param {string[]} pageTexts 每页的文字层，下标 0 = PDF 第 1 页
 * @param {{budget?:number, perPage?:number}} [opts] budget 为索引总字符上限
 * @returns {string} 每页一行：`p31 (印刷84) | 9 其他净收支 政府补助 …`
 */
/**
 * 文件越多，每页摘要越短。单文件时给足 80 字，六文件时压到 40 字。
 * 下限 24 字：再短连表名都放不下，那就不是薄索引而是没有索引了。
 */
export function autoPerPage(fileCount) {
  const n = Number.isFinite(fileCount) && fileCount > 0 ? fileCount : 1;
  return Math.max(24, Math.min(80, Math.round(240 / n)));
}

export function buildPageIndex(pageTexts, opts = {}) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [];
  if (pages.length === 0) return '';

  const budget = opts.budget ?? 16000;
  // 每页摘要长度。**默认随文件数收缩**——索引是单轮固定开销里最大的一项：
  // 2026-08-13 实测六份地铁年报的索引 25,819 字符 ≈ 21.9K token，占单次调用
  // 23.7K 的 85%，而且**每轮重发**。一天 19 次调用烧掉 451K，把 1M 的免费桶打到只剩 248K。
  //
  // 为什么敢压：索引的职责是给个地形，精确定位交给 FIND（search-pages.js）——
  // 那是零成本的本地查找。80 字里真正携带信号的通常是前 40 字（章节名/表名就在开头），
  // 后半截多是数字和正文碎片。压到 40 字，六文件场景的索引直接减半。
  const perPage = opts.perPage ?? autoPerPage(opts.fileCount);
  const { numbers, trustworthy } = detectPrintedPages(pages);

  // 前缀（`p148 (印刷146) | `）本身要占预算。先按最长的那个前缀估一份开销，再把
  // 剩下的预算平摊给摘要 —— **不能靠减页数来省预算**：少一页，模型就永远不会索要它，
  // 而"没被索要的页"和"不存在的页"对它是同一回事。
  const sample = `p${pages.length}${trustworthy ? ` (印刷${numbers[pages.length - 1] ?? 0})` : ''} | \n`;
  const overhead = sample.length * pages.length;
  const room = Math.max(8, Math.floor((budget - overhead) / pages.length));
  const summaryLen = Math.min(perPage, room);

  return pages
    .map((raw, i) => {
      const printed = trustworthy && numbers[i] !== null ? ` (印刷${numbers[i]})` : '';
      const text = normalizeCjkSpacing(String(raw || '').replace(/\s+/g, ' ')).trim();
      const summary = text ? text.slice(0, summaryLen) : '（无文字层）';
      return `p${i + 1}${printed} | ${summary}`;
    })
    .join('\n');
}
