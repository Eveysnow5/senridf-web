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

  // 按文件号顺序输出，页码去重升序；总页数超上限时**按出现顺序截断**，
  // 而不是按文件均分——模型先说的通常是它最想看的。
  let budget = maxPages;
  const requests = [];
  for (const fileIndex of [...byFile.keys()].sort((a, b) => a - b)) {
    if (budget <= 0) break;
    const pages = [...new Set(byFile.get(fileIndex))].sort((a, b) => a - b).slice(0, budget);
    if (pages.length === 0) continue;
    budget -= pages.length;
    requests.push({ fileIndex, pages });
  }

  return requests.length ? { done: false, requests } : DONE;
}
