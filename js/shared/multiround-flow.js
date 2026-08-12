// 客户端纯逻辑：拿到解析结果后，决定"再取一轮"还是"到此作答"。
// 照 lifestory-flow.js 的先例抽出来——多轮循环写在 analysis.html 的内联脚本里，
// 而 `npm run check` 覆盖不到内联脚本；循环里最危险的恰恰是"什么时候停"。
//
// 三条终止路径，缺一条就会空转到轮数上限、让用户白等两分钟：
//   ① 模型自己说够了（parsed.done）
//   ② 模型索要的页**全都取过了**——它在原地打转，再给它一遍同样的图不会有新信息
//   ③ 轮数到顶
//
// ②最容易漏。实测前的判断是：模型看不到"我已经看过哪些页"的显式清单（prompt 里只
// 让它"别重复索要"），所以重复索要是可预期的常态，而不是异常。

/**
 * @param {{done:boolean, requests:{fileIndex:number, pages:number[]}[]}} parsed
 *   parsePageRequest 的返回值
 * @param {Array<number[]|Set<number>>} sentByFile 各文件已经送过的页码（下标 = fileIndex-1）
 * @param {number} round 当前轮次（1 起）
 * @param {number} maxRounds 轮数上限
 * @returns {{done:boolean, requests:{fileIndex:number, pages:number[]}[]}}
 */
export function decideNextRound(parsed, sentByFile, round, maxRounds) {
  const STOP = { done: true, requests: [] };
  if (!parsed || parsed.done) return STOP;
  if (!Number.isFinite(round) || !Number.isFinite(maxRounds) || round >= maxRounds) return STOP;

  const sent = Array.isArray(sentByFile) ? sentByFile : [];
  const has = (i, p) => {
    const s = sent[i - 1];
    if (!s) return false;
    return typeof s.has === 'function' ? s.has(p) : s.includes(p);
  };

  const requests = (parsed.requests || [])
    .map((r) => ({
      fileIndex: r.fileIndex,
      pages: (r.pages || []).filter((p) => !has(r.fileIndex, p)),
    }))
    .filter((r) => r.pages.length > 0);

  return requests.length ? { done: false, requests } : STOP;
}
