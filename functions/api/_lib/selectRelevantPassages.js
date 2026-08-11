// 按提问挑选文档片段，替代"从开头硬截 N 字"。
//
// 为什么需要
// 原实现是 `content.slice(0, 30000)`。用户上传 187,405 字的年报、问"处置荣耀
// 产生的利润对财务报表有多大影响"，答案在「合并财务报表附注」——文档后半部分，
// 早被截掉了。于是模型回答"文件中未明确披露"，而那句话是假的：**不是没披露，
// 是没送给它看**。截掉 84% 的内容后，再怎么调提示词也只能得到更自信的"未披露"。
//
// 为什么用 IDF 加权而不是单纯数命中次数
// 提问"华为处置子公司荣耀产生的利润……"里，"华为"在年报里每页都有、"荣耀"只在
// 少数段落出现。按命中次数排序会让满篇"华为"的段落霸榜，真正相关的段落反而排不
// 上去。IDF（出现在越少段落里的词权重越高）自动把"华为"降权、"荣耀"升权——这是
// 这个函数能work的关键，不是可选的优化。
//
// 刻意不做的事：不引入 embedding / 向量库。这是本地纯计算、零额外 API 调用、
// 零新依赖；配额是当前瓶颈，多一次 embedding 调用就多一份消耗。

/** 中文没有空格，无法按词切分；这些高频虚词/量词单独出现时不携带检索价值。 */
const STOPWORDS = new Set([
  '的',
  '了',
  '是',
  '在',
  '和',
  '与',
  '对',
  '有',
  '为',
  '及',
  '或',
  '把',
  '被',
  '从',
  '到',
  '于',
  '这',
  '那',
  '什么',
  '多少',
  '多大',
  '如何',
  '怎样',
  '哪些',
  '是否',
  '请',
  '帮我',
  '分析',
  '说明',
  '介绍',
  '一下',
  '产生',
  '进行',
  '情况',
  '问题',
  '影响',
  '方面',
  '相关',
  '以及',
  '我们',
  '可以',
]);

/**
 * 从提问里抽检索词。中文按标点和虚词切段，英文/数字按单词切。
 * @param {string} question
 * @returns {string[]} 去重后的检索词
 */
export function extractTerms(question) {
  const raw = String(question || '');
  if (!raw.trim()) return [];

  const terms = new Set();

  // 英文单词与年份等数字串
  for (const m of raw.matchAll(/[A-Za-z][A-Za-z0-9_-]{1,}|\d{4}/g)) {
    terms.add(m[0].toLowerCase());
  }

  // 中文没有分词器，用 2~4 字滑窗 n-gram 当候选，噪音交给 IDF 压制。
  //
  // 曾经写成"取 2~6 字、被更长候选覆盖就跳过"，结果长句里只剩 6 字 n-gram
  // （如「置子公司荣耀」），而文档原文是「处置荣耀终端有限公司」——一个都匹配
  // 不上，零命中直接走兜底。**候选要短才匹配得上**，长度不是精度。
  for (const chunk of raw.split(/[^一-鿿]+/)) {
    if (!chunk || chunk.length < 2) continue;
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i + len <= chunk.length; i++) {
        const t = chunk.slice(i, i + len);
        // 只剔掉"整个 n-gram 就是停用词"的情况，其余一律留给 IDF 压制。
        //
        // 曾经加过一层"含单字虚词就剔掉"，结果把**公司名「华为」**（含「为」）
        // 直接杀掉了，连带 会计政策(会)/数字能源(能)/有限公司(有)/在建工程(在)/
        // 对外投资(对) 这些财报关键词一起误伤——检索词只剩「荣耀」，高频词与稀有词
        // 的竞争压根没发生（是跑突变验证时打印检索词才发现的）。
        // IDF 的全部意义就是不需要激进的停用词过滤：「的利」这类噪音出现在几乎每个
        // 块里，idf 趋近 0，本来就贡献不了分数。
        if (STOPWORDS.has(t)) continue;
        terms.add(t);
      }
    }
  }

  return [...terms];
}

/**
 * 按空行把长文切块：过短的合并、过长的再切。
 *
 * 两端都必须封口，这是单测抓出来的：
 *  · 只做"合并短块"时，如果全文的段落都短于 minLen，就会**全部并成一个巨块**，
 *    装不进预算被整体跳过，最后什么都选不出来。所以合并要有上限 maxLen。
 *  · 只做"合并"不做"切分"时，真实年报里「合并财务报表附注」常是一大段，
 *    单块超过预算同样会被整体跳过——恰好丢掉最该看的部分。所以要能切开。
 */
function splitBlocks(text, minLen, maxLen) {
  const out = [];
  for (const raw of String(text).split(/\n{2,}/)) {
    const t = raw.trim();
    if (!t) continue;
    if (t.length > maxLen) {
      for (let i = 0; i < t.length; i += maxLen) out.push(t.slice(i, i + maxLen));
      continue;
    }
    const last = out[out.length - 1];
    if (last !== undefined && last.length < minLen && last.length + t.length + 2 <= maxLen) {
      out[out.length - 1] = last + '\n\n' + t;
    } else {
      out.push(t);
    }
  }
  return out;
}

/**
 * 按提问挑选片段。
 *
 * 无提问时退回"取开头"——那是综合分析模式，开头的经营概述本来就是最该看的。
 * 有提问时：始终保留开头一小段（主体名称、报告期间、货币单位这些身份信息，
 * 后面的片段脱离它就无法解读），其余预算留给命中检索词的块，并**按原文顺序**
 * 拼回去（时间/章节顺序是财务文档的语义一部分，打乱会让模型误判先后）。
 *
 * @param {string} text 全文
 * @param {string} question 用户提问，空则退回取开头
 * @param {{budget?:number, headChars?:number, minBlockLen?:number}} [opts]
 * @returns {{text:string, mode:'head'|'selected', usedChars:number, totalChars:number, hitTerms:string[]}}
 */
export function selectRelevantPassages(text, question, opts = {}) {
  const full = String(text || '');
  const budget = opts.budget ?? 80000;
  const headChars = opts.headChars ?? 4000;
  const minBlockLen = opts.minBlockLen ?? 200;
  // 单块上限：既防"短段全并成一个巨块"，也防"附注一大段超预算被整体跳过"
  const maxBlockLen = opts.maxBlockLen ?? Math.max(1200, Math.floor(budget / 8));
  const totalChars = full.length;

  // 短到装得下就整篇送，不必挑
  if (totalChars <= budget) {
    return { text: full, mode: 'head', usedChars: totalChars, totalChars, hitTerms: [] };
  }

  const terms = extractTerms(question);
  if (terms.length === 0) {
    return {
      text: full.slice(0, budget),
      mode: 'head',
      usedChars: Math.min(budget, totalChars),
      totalChars,
      hitTerms: [],
    };
  }

  const blocks = splitBlocks(full, minBlockLen, maxBlockLen);

  // IDF：出现在越少块里的词，权重越高
  const df = new Map();
  for (const t of terms) {
    let n = 0;
    for (const b of blocks) if (b.includes(t)) n++;
    df.set(t, n);
  }
  const N = blocks.length || 1;

  const scored = blocks.map((b, i) => {
    let score = 0;
    const hits = [];
    for (const t of terms) {
      const n = df.get(t);
      if (!n) continue; // 全文都没出现，跳过
      const occurrences = b.split(t).length - 1;
      if (occurrences === 0) continue;
      const idf = Math.log(1 + N / n);
      // 次数取对数，防止一个块里重复十次就压倒其它块
      score += idf * (1 + Math.log(occurrences));
      hits.push(t);
    }
    return { i, b, score, hits };
  });

  // 开头片段无条件保留：身份与期间信息
  const head = full.slice(0, Math.min(headChars, totalChars));
  let used = head.length;

  const chosen = [];
  const hitTerms = new Set();
  for (const item of [...scored].sort((a, b) => b.score - a.score)) {
    if (item.score <= 0) break;
    if (used + item.b.length > budget) continue; // 装不下就跳过，继续看更小的块
    chosen.push(item);
    used += item.b.length;
    for (const h of item.hits) hitTerms.add(h);
  }

  if (chosen.length === 0) {
    // 一个命中块都装不下（或全文都没命中）。退回取开头，并把这个事实报出去，
    // 否则会返回"只有 head 没有正文"的怪结果，而调用方无从知道筛选失败了。
    return {
      text: full.slice(0, budget),
      mode: 'head',
      usedChars: Math.min(budget, totalChars),
      totalChars,
      hitTerms: [],
    };
  }

  chosen.sort((a, b) => a.i - b.i); // 还原原文顺序

  const body = chosen.map((c) => c.b).join('\n\n（……中间内容与本次提问无关，已省略……）\n\n');

  return {
    text: `${head}\n\n（……以下为按本次提问筛选出的相关段落，非全文，段落间可能不连续……）\n\n${body}`.trim(),
    mode: 'selected',
    usedChars: used,
    totalChars,
    hitTerms: [...hitTerms],
  };
}
