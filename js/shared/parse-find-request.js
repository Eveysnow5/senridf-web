// 解析模型的查找指令。多轮取页的第 4 块积木。
//
// 契约（与 parse-page-request 并列，两者可同轮出现）：
//   FIND: 文件1:其他收益,政府补助 文件3:Statements of Income
//   FIND: 其他收益            ← 不写文件号 = 全部文件都找
//
// 为什么要有它：索引是"每页开头 80 字"，开头几页天然是封面/声明/目录，最不能代表
// 全文。2026-08-13 实测模型读了东京索引前 5 行就断定"没有损益表"、主动放弃索要，
// 而索引第 9 行明写着 `p14 | Consolidated Statements of Income`。
// **把"要不要看完"从模型的自觉，变成机械保证。**
//
// 沿用 parse-page-request 的两条设计：
//   ① 判据正向——解析不出来就是"没有查找请求"，绝不让循环因为格式跑偏而空转；
//   ② 括号内容整段删掉——模型爱把说明写在括号里（"其他收益（政府补助的载体）"），
//      不删的话逗号分词会把说明也当成查找词。

/** 一轮最多找几个词。词太多回执会撑大，而且说明模型在漫无目的地扫。 */
const DEFAULT_MAX_TERMS = 6;

/**
 * @param {string} text 模型本轮的输出
 * @param {number} fileCount 本次分析的文件数
 * @param {{maxTerms?:number}} [opts]
 * @returns {{finds:{fileIndex:number|null, terms:string[]}[]}}
 */
export function parseFindRequest(text, fileCount, opts = {}) {
  const NONE = { finds: [] };
  const raw = String(text || '');
  if (!raw.trim()) return NONE;
  if (!Number.isFinite(fileCount) || fileCount <= 0) return NONE;
  const maxTerms = opts.maxTerms ?? DEFAULT_MAX_TERMS;

  const cleaned = raw.replace(/^\s*```.*$/gm, '').replace(/[（(][^）)]*[）)]/g, '');
  const lines = cleaned
    .split('\n')
    .map((l) => l.match(/FIND\s*[:：]\s*(.*)$/i))
    .filter(Boolean)
    .map((m) => m[1].trim())
    .filter(Boolean);
  if (lines.length === 0) return NONE;

  const byFile = new Map(); // fileIndex|null -> terms[]
  let total = 0;

  for (const line of lines) {
    if (total >= maxTerms) break;
    // 带文件号的分组：文件N:词1,词2
    const groups = [...line.matchAll(/(?:文件|file)\s*(\d+)\s*[:：]\s*([^文]*)/gi)];
    if (groups.length > 0) {
      for (const g of groups) {
        const fi = Number(g[1]);
        if (!Number.isInteger(fi) || fi < 1 || fi > fileCount) continue;
        for (const t of splitTerms(g[2])) {
          if (total >= maxTerms) break;
          push(byFile, fi, t);
          total++;
        }
      }
    } else {
      // 不写文件号 = 所有文件都找
      for (const t of splitTerms(line)) {
        if (total >= maxTerms) break;
        push(byFile, null, t);
        total++;
      }
    }
  }

  const finds = [...byFile.entries()]
    .map(([fileIndex, terms]) => ({ fileIndex, terms: [...new Set(terms)] }))
    .filter((f) => f.terms.length > 0)
    // null（全文件）排最后，读起来顺
    .sort((a, b) => (a.fileIndex ?? 1e9) - (b.fileIndex ?? 1e9));

  return finds.length ? { finds } : NONE;
}

/** 词之间用逗号/顿号/竖线分隔；单个词太短（1 字）没有检索价值，丢掉。 */
function splitTerms(s) {
  return String(s || '')
    .split(/[,，、|]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function push(map, key, term) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(term);
}
