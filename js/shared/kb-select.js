// 按提问从知识库里挑条目。纯函数，零额外 API 调用、零新依赖。
//
// 为什么不用 embedding：库是三到十条量级，关键词足够；而配额是当前瓶颈，多一次
// embedding 调用就多一份消耗（同 select-relevant-passages.js 的取舍）。
//
// ⚠️ **选不中就一条都不给，不要"保底给一条"。**
// 无关的条目会把模型往那个方向诱导——问"营收增长多少"却塞一条政府补助的准则，
// 它就会开始往补助上解释。宁可没有背景知识，也不要给错方向的背景知识。

/** 一次最多给几条。给多了既吃 token，又让模型有挑着用的余地。 */
const DEFAULT_MAX = 3;

/**
 * @param {string} question 用户提问
 * @param {Array} entries 知识库条目（KB_ENTRIES）
 * @param {{max?:number}} [opts]
 * @returns {Array} 命中的条目，按命中词数降序；一条都不命中时返回空数组
 */
export function selectKbEntries(question, entries, opts = {}) {
  const q = String(question || '');
  if (!q.trim() || !Array.isArray(entries)) return [];
  const max = opts.max ?? DEFAULT_MAX;

  const scored = [];
  for (const e of entries) {
    const terms = Array.isArray(e?.terms) ? e.terms : [];
    const hits = terms.filter((t) => t && q.includes(t));
    if (hits.length > 0) scored.push({ entry: e, hits: hits.length });
  }

  // 命中词多的排前面；并列时保持原始顺序（库里的顺序是人排的，有意义）
  return scored
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .slice(0, max)
    .map((s) => s.entry);
}

/**
 * 把选中的条目渲染成注入用的文本。
 *
 * ⚠️ `doesNotSay` 必须跟着一起给。只给规则不给边界，等于给过度解读发了一张
 * 看起来正规的许可证——三次实跑的违规形态正是"把单向规则读成双向"。
 */
export function renderKbBlock(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const body = entries
    .map((e) => {
      // 用户问的是日常词（"政府补助"），报表里印的是科目名（"其他收益" / "Subsidies"）。
      // 不把这层对应关系说出来，模型拿着日常词去页面索引里找，什么都找不到。
      const names =
        Array.isArray(e.lineItemNames) && e.lineItemNames.length
          ? `\n📖 报表里通常印作：${e.lineItemNames.join(' / ')}——**在页面索引里就按这些名字找**。`
          : '';
      return `【${e.source}】\n${e.text}\n⚠️ 这一条**没有**说：${e.doesNotSay}${names}\n引用时写作：（准则库·${e.source}）`;
    })
    .join('\n\n');
  return [
    '【准则库】以下条目来自已核实的会计准则原文，**是一种合法的出处**，可以引用。',
    '但它们只解释科目含义与列报规则，**不提供任何公司的任何数字**——数字必须来自上传的文件。',
    '知识库里没有的背景知识，仍然不许用。',
    '⚠️ 用户会用日常说法提问（如"政府补助"），而报表里印的是科目名（如"其他收益"、"Subsidies"）。',
    '**别因为索引里搜不到用户的原话就判定"文件没有"**——先按下面每条给出的科目名去找。',
    '',
    body,
  ].join('\n');
}
