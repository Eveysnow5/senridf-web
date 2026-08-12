// 按提问挑出 PDF 里最相关的页码。
//
// 为什么要按"页"而不是按"文本块"
// 财报的答案几乎都在表格里，而文本抽取会把表格的二维结构压平——pdf.js 的
// `items.map(i=>i.str).join(' ')` 把行名和数字拼成一维字符串，之后无论检索多准、
// 提示词多硬，模型拿到的都是一堆无法对齐的数字。2026-08-11 实测同一张
// 「其他净收支」表：抽成文本后模型读不出来，把那一页渲染成图片则一眼可读
// （行名、附注编号、两个年份列、「–」、括号负数全部准确）。
//
// 所以正确分工是：**文本层只用来定位页码，视觉负责读内容。**
// 这也正是 Claude Code 自己读 PDF 的方式——渲染成图像看，不做文本抽取。
//
// 选页目标同样是**覆盖稀有词**而非取高分页。实测提问
// 「请问从华为的年报看，处置荣耀手机业务的影响，在2024年和2025年分别是多少」：
//   纯按分数：含「荣耀」的第 86 页排第 11/148，勉强进 top12
//   稀有词覆盖：只选 5 页（22/46/51/86/107），第 86 页必在其中
// 5 页图片约 1 万 token，而 8 万字文本约 5.5 万 token —— 既准又便宜。
//
// 覆盖逻辑有多稳：2026-08-12 在真实全文 148 页上试提问
// 「帮我看看两期年报，评估处置荣耀业务对华为的财务报表有多大影响」，
//   maxPages=1 → [100]              第 86 页丢了
//   maxPages=2 → [86,100]           已包含
//   maxPages=3 → [84,86,100]        已包含
//   maxPages=8 → [64,66,71,84,86,100,107,109]
// 也就是说给到 2 页就够选中关键页。这很要紧：调用方（analysis.html）受 Workers
// 10ms CPU 配额限制、只能送很少几页图片，能少送而不丢答案是这条路线成立的前提。

import { extractTerms, normalizeCjkSpacing } from './select-relevant-passages.js';

/**
 * @param {string[]} pageTexts 每页的文本，下标 0 对应第 1 页
 * @param {string} question 用户提问；空则返回空数组（综合分析走文本路径）
 * @param {{maxPages?:number}} [opts]
 * @returns {{pages:number[], ranked:number[], distinctiveTerms:string[], missingTerms:string[]}}
 *   pages 是 1 起的页码、已升序（送给模型时按原文顺序更好读）；
 *   ranked 是同一批页码但保持**挑选优先级**顺序（稀有词覆盖在前、分数在后）。
 *   调用方受字节预算限制、装不下全部页时，必须按 ranked 从后往前砍——
 *   按 pages 砍等于砍掉页码最大的那几页，与重要性无关。
 */
export function selectRelevantPages(pageTexts, question, opts = {}) {
  const maxPages = opts.maxPages ?? 8;
  const texts = (pageTexts || []).map((t) => normalizeCjkSpacing(String(t || '')));
  if (texts.length === 0) return { pages: [], ranked: [], distinctiveTerms: [], missingTerms: [] };

  const terms = extractTerms(question);
  if (terms.length === 0) return { pages: [], ranked: [], distinctiveTerms: [], missingTerms: [] };

  const df = new Map();
  for (const t of terms) df.set(t, texts.filter((p) => p.includes(t)).length);
  const N = texts.length;

  const scored = texts.map((p, i) => {
    let score = 0;
    for (const t of terms) {
      const n = df.get(t);
      if (!n) continue;
      const c = p.split(t).length - 1;
      if (!c) continue;
      score += Math.log(1 + N / n) * (1 + Math.log(c));
    }
    return { page: i + 1, score };
  });
  const byScore = [...scored].sort((a, b) => b.score - a.score);

  // 稀有词优先。df===0 的词全文都没有，单独报出来——那是"文档里真的没这个词"，
  // 比让模型写三段话让人推断有用得多。
  const present = terms.filter((t) => df.get(t) > 0);
  const absent = terms.filter((t) => !df.get(t));
  const distinctive = [...present].sort((a, b) => df.get(a) - df.get(b)).slice(0, maxPages);

  const chosen = new Set();
  for (const t of distinctive) {
    if (chosen.size >= maxPages) break;
    const best = byScore.find((x) => !chosen.has(x.page) && texts[x.page - 1].includes(t));
    if (best) chosen.add(best.page);
  }
  for (const x of byScore) {
    if (chosen.size >= maxPages) break;
    if (x.score > 0) chosen.add(x.page);
  }

  // 只报"极小"的缺失词，否则「荣耀」「处置荣耀」「荣耀业务」会一起刷出来变噪音
  const missingTerms = absent
    .filter((t) => !absent.some((o) => o !== t && t.includes(o)))
    .slice(0, 8);

  return {
    pages: [...chosen].sort((a, b) => a - b),
    ranked: [...chosen],
    distinctiveTerms: distinctive,
    missingTerms,
  };
}
