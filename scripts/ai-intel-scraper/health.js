// 一轮跑完之后判断这轮到底算不算成功。纯逻辑、无依赖，可 node --test。
//
// 为什么需要这个：2026-08-09 起连续三周失败，**GitHub Actions 每次都报 success**。
// 原因是各处失败都被设计成"不中断整轮"——单条判定失败落旁路、简报失败只打日志。
// 每一条单独看都合理，合起来的效果是**整条链路瘫痪也没有任何人被通知**。
// 三周里各死一种（103×403 / 60 秒超时 / 49×403），最后是作者发现情报页
// 还停在 W31 才发现的。
//
// 所以"进程退出码"必须重新定义：不是"脚本有没有崩"，而是"这轮有没有产出"。

// 判定失败占比超过这个数，就认为判定链路瘫痪而不是个别文章有问题。
//
// ⚠️ 这个阈值只有四个样本（2026-W31~W34）：0% / 100% / 4.6% / 46%。
// 样本之间差距很大，0.3 落在明显的空档里，但**这不等于它经得起第五个样本**。
// 若将来出现"正常轮次也 30% 报错"，先看是不是信源变了，别急着调高——
// 调高阈值等于把瘫痪重新定义成正常。
const LLM_ERROR_RATIO_LIMIT = 0.3;

/**
 * @param {object} r
 * @param {number} r.found           本轮从信源抓到的候选总数（去重之前）
 * @param {number} r.skippedDup      其中因为已经入过库而跳过的条数
 * @param {number} r.ingested        本轮新入库条数
 * @param {number} r.filtered        本轮被判定为无关而滤掉的条数（这是**结论**，不是失败）
 * @param {number} r.llmErrors       拿不到判定的条数
 * @param {boolean} r.digestAttempted 本轮是否尝试生成简报（有新增才会尝试）
 * @param {boolean} r.digestWritten   简报是否真的写进了 Firestore
 * @returns {{ok: boolean, reasons: string[]}}
 */
function runHealth({
  found = 0,
  skippedDup = 0,
  ingested = 0,
  filtered = 0,
  llmErrors = 0,
  digestAttempted = false,
  digestWritten = false,
} = {}) {
  const reasons = [];

  // 简报是这条链路的**产出物**。尝试了却没写成，这一周在知识库里就是个洞，
  // 而且洞不会自己长回来 —— 下周跑的是下周的简报。
  if (digestAttempted && !digestWritten) {
    reasons.push('本周简报没有生成（尝试过但失败）');
  }

  const judged = ingested + filtered + llmErrors;
  if (llmErrors > 0 && judged > 0) {
    const ratio = llmErrors / judged;
    if (ratio > LLM_ERROR_RATIO_LIMIT) {
      reasons.push(
        `判定失败占比 ${(ratio * 100).toFixed(0)}%（${llmErrors}/${judged}），` +
          `超过 ${LLM_ERROR_RATIO_LIMIT * 100}% —— 多半是额度/密钥/模型的问题，不是个别文章`,
      );
    }
  }

  // ⚠️ 2026-08-25 修正：这里原本写的是「judged === 0 就不健康」，理由是
  // "信源全挂或抓取被拦"。当天手动连跑三次，第三次所有条目都已入过库、
  // 全部去重跳过 → judged 为 0 → **误报**。信源明明是好的（解析出近 300 条）。
  //
  // 教训跟阈值那条一样：判据只在**四个历史样本**上验过，而那四轮里没有一轮是
  // "抓到了但全是旧的"。真实世界的形态永远比手里的样本多一种。
  //
  // 现在分三种：
  if (found === 0) {
    // 一条都没抓到 —— 这才是信源全挂
    reasons.push('本轮一条候选都没抓到 —— 信源全挂或抓取被拦');
  } else if (judged === 0 && skippedDup === 0) {
    // 抓到了，却既没判定也没去重 —— 条目凭空消失了，是真 bug
    reasons.push(`抓到 ${found} 条候选，却既没判定也没去重 —— 条目在中途丢了`);
  }
  // 抓到了、但全部因为已入库而跳过 = **正常**（这一轮确实没有新东西），不报警。

  return { ok: reasons.length === 0, reasons };
}

module.exports = { runHealth, LLM_ERROR_RATIO_LIMIT };
