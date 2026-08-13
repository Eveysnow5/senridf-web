// 从模型输出里解析取页指令。多轮取页的第 2 块积木。
// 见 docs/plans/2026-08-12-analysis-multiround-plan.md。
//
// 契约（两端共用，改这里就要同步改 buildAnalysisSystemPrompt）：
//   NEED_PAGES: 文件1:86,87 文件2:84
//   ANSWER: <正文>
//
// ★ 最重要的一条：**解析不出来 = 结束**。
// 多轮循环里若"解析失败"不等于"该作答了"，模型一次格式跑偏就会让循环空转到轮数上限，
// 用户白等两分钟还拿不到答案。所以判据是正向的：**确实解析出至少一页才继续**，
// 其余一切情形（空指令 / 中文数字 / 文件号越界 / 页码越界 / 压根没有指令）一律 done。
// 这样"格式没见过"的失败模式自动落到安全的一侧，不需要枚举所有坏格式。
//
// ★ 第二条：括注里的印刷页码必须丢掉。
// 索引给模型的格式是 `p86 (印刷84) | 摘要`（见 build-page-index.js：模型引的页码是
// PDF 页序，而年报自己印的是 84，差 2 页）。模型很可能把括注一起抄回来，而**两个数
// 都是合法页码**——取错了页事后无从发现，只会得到一份读起来很正常但看错了页的分析。
// 所以解析前先把括号内容整段删掉。

/** 页码上限：模型会索要一整本。一轮的字节预算只装得下几页，多要的也渲染不出来。 */
const DEFAULT_MAX_PAGES = 8;

/**
 * @param {string} text 模型本轮的输出
 * @param {number} fileCount 本次分析的文件数
 * @param {number[]} [totalPagesByFile] 各文件的总页数，用于过滤越界页码；缺省则不过滤
 * @param {{maxPages?:number}} [opts]
 * @returns {{done:boolean, requests:{fileIndex:number, pages:number[]}[]}}
 */
export function parsePageRequest(text, fileCount, totalPagesByFile, opts = {}) {
  const DONE = { done: true, requests: [] };
  const raw = String(text || '');
  if (!raw.trim()) return DONE;
  if (!Number.isFinite(fileCount) || fileCount <= 0) return DONE;

  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;

  // ① 去掉 markdown 代码围栏；② 删掉括号内容（印刷页码括注就藏在这里）
  const cleaned = raw.replace(/^\s*```.*$/gm, '').replace(/[（(][^）)]*[）)]/g, '');

  // 指令写在一行里；多行 NEED_PAGES 全部合并——宁可多认一行，也别丢掉一份文件
  const lines = cleaned
    .split('\n')
    .map((l) => l.match(/NEED_PAGES\s*[:：]\s*(.*)$/i))
    .filter(Boolean)
    .map((m) => m[1]);
  if (lines.length === 0) return DONE;

  const byFile = new Map();
  for (const line of lines) {
    // `文件1:86,87` / `文件1 : p86 , 87` / `file2:84`
    for (const m of line.matchAll(/(?:文件|file)\s*(\d+)\s*[:：]\s*([\dp,，\s]+)/gi)) {
      const fileIndex = Number(m[1]);
      if (!Number.isInteger(fileIndex) || fileIndex < 1 || fileIndex > fileCount) continue;

      const limit = Array.isArray(totalPagesByFile) ? totalPagesByFile[fileIndex - 1] : undefined;
      const pages = [...m[2].matchAll(/p?(\d+)/gi)]
        .map((p) => Number(p[1]))
        .filter((n) => n >= 1 && (limit === undefined || n <= limit));
      if (pages.length === 0) continue;

      const prev = byFile.get(fileIndex) || [];
      byFile.set(fileIndex, prev.concat(pages));
    }
  }
  if (byFile.size === 0) return DONE;

  // 按文件号顺序输出，页码去重升序；总页数超上限时**轮转分配**（见下），
  // 保证每份被索要的文件至少拿到一页。
  // ⚠️ **轮转分配，不是顺序截断。**
  // 原来是按文件号依次 slice(0, budget)，于是**第一份文件能吃光全部配额**——模型一次
  // 索要 6 份文件时，排在后面的几份直接归零，而且它不会知道自己被饿死了。
  // 2026-08-13 实测：东京两份年报的利润表页一次都没渲染出来，模型只能答"本轮未渲染
  // 该页图像"，而用户问的是三家公司。**广度优先于深度**：每份文件先各拿一页，再回头
  // 补第二页——先看全，再看深。
  const order = [...byFile.keys()].sort((a, b) => a - b);
  // ⚠️ **保留模型说出来的顺序，不要在这里排序。**
  // 这里原本 sort 成升序，于是轮转取 list[0] 时拿到的是**页码最小**的那页，而不是
  // 模型最想看的那页。2026-08-13 实测：东京索要 f3:10,14，p14 才是合并损益表、
  // p10 只是业绩综述文字页——升序让它拿到了 p10，于是那一轮白取。
  // 模型先说的就是它最想看的；升序只用于**最终输出**（读起来按原文顺序才连贯）。
  const dedupeKeepOrder = (arr) => [...new Set(arr)];
  const available = new Map(order.map((i) => [i, dedupeKeepOrder(byFile.get(i))]));
  const picked = new Map(order.map((i) => [i, []]));
  let taken = 0;
  for (let depth = 0; taken < maxPages; depth++) {
    let progressed = false;
    for (const i of order) {
      if (taken >= maxPages) break;
      const list = available.get(i);
      if (depth < list.length) {
        picked.get(i).push(list[depth]);
        taken++;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  const requests = order
    .filter((i) => picked.get(i).length > 0)
    .map((i) => ({ fileIndex: i, pages: picked.get(i).sort((x, y) => x - y) }));

  return requests.length ? { done: false, requests } : DONE;
}
