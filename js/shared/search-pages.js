// 在已抽好的 pageTexts 里做关键词查找，把命中的页码报回给模型。
//
// 为什么需要它（2026-08-13 实测的失败）：
// 页面索引是"每页开头 80 字"。一份文件的开头几页天然是封面、翻译声明、目录——
// **恰恰最不能代表全文**。模型读了东京索引的前 5 行（翻译声明 / cash flows / 目录），
// 就断定"仅为现金流量表及目录，未见损益表"，主动放弃索要；而第 9 行明明写着
// `p14 | (2) Consolidated Statements of Income and Comprehensive Income`。
// **它有能力读，只是没读到。** 索引越长、文件越多，这个陷阱越深。
//
// 分工：**语义扩展由模型做**（它知道「政府补助」在报表里可能印作「其他收益」、
// 「Subsidies」、「補助金」），**机械查找由这里做**。中间不需要任何要维护的词表——
// 词表 O(概念数) 永远补不全，而模型本来就会联想。
//
// 成本：零。文本在解析 PDF 时就抽好了，搜索在浏览器里跑，不产生任何 API 调用。

import { normalizeCjkSpacing } from './select-relevant-passages.js';
import { findCaveat } from './text-layer.js';

/** 一个词最多报几页命中。报太多会把回执撑大，而模型也只会挑前几页。 */
const MAX_HITS_PER_TERM = 8;
/** 每条命中附带的上下文长度。够判断"是不是我要的那个"即可。 */
const SNIPPET = 60;

/**
 * @param {string[]} pageTexts 每页文字层，下标 0 = 第 1 页
 * @param {string[]} terms 要找的词
 * @param {{maxHits?:number, snippet?:number}} [opts]
 * @returns {{term:string, hits:{page:number,count:number,snippet:string}[]}[]}
 */
export function searchPages(pageTexts, terms, opts = {}) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [];
  const list = Array.isArray(terms) ? terms.filter((t) => t && String(t).trim()) : [];
  if (pages.length === 0 || list.length === 0) return [];

  const maxHits = opts.maxHits ?? MAX_HITS_PER_TERM;
  const snip = opts.snippet ?? SNIPPET;

  // 归一化一次就够：汉字间被插的空格会让匹配静默失效（「其 他 收 益」）。
  const norm = pages.map((p) => normalizeCjkSpacing(String(p || '').replace(/\s+/g, ' ')));

  return list.map((rawTerm) => {
    const term = String(rawTerm).trim();
    // 英文不区分大小写；中文没有大小写，lower 不影响
    const needle = term.toLowerCase();
    const hits = [];
    for (let i = 0; i < norm.length && hits.length < maxHits; i++) {
      const hay = norm[i].toLowerCase();
      const at = hay.indexOf(needle);
      if (at < 0) continue;
      const count = hay.split(needle).length - 1;
      const from = Math.max(0, at - Math.floor(snip / 3));
      hits.push({ page: i + 1, count, snippet: norm[i].slice(from, from + snip).trim() });
    }
    return { term, hits };
  });
}

/**
 * 渲染成给模型看的回执。
 *
 * ⚠️ **一个词都没命中时也要明说**，不能省略。"没有回执"和"回执说没命中"对模型是
 * 两回事：前者它会以为搜索没跑、可能再搜一次；后者才是可以据以判断"文件里确实没有"
 * 的证据（也才对得上核心规则第九条——区分"文件没有"和"我没看到"）。
 */
export function renderFindResults(results, fileLabel, assessment) {
  if (!Array.isArray(results) || results.length === 0) return '';
  const lines = results.map((r) => {
    if (!r.hits.length) return `  「${r.term}」：全文未命中`;
    const where = r.hits.map((h) => `p${h.page}(${h.count}次)`).join(' ');
    const eg = r.hits[0];
    return `  「${r.term}」：${where}\n    例 p${eg.page}：…${eg.snippet}…`;
  });
  // ⚠️ 扫描件上「全文未命中」是**必然结果**，跟"文件里没有"毫无关系。
  // 不加这句尾注，上面那行字面上完全正确的回执，会把模型直接引向一个错误结论。
  // （2026-08-13 韩红样本实测的形态：系统层面造成的"把读不了说成没有"。）
  const caveat = findCaveat(assessment);
  return `【${fileLabel}】查找结果\n${lines.join('\n')}${caveat ? '\n' + caveat : ''}`;
}
