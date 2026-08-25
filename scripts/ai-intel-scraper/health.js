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
 * @param {number} r.ingested        本轮新入库条数
 * @param {number} r.filtered        本轮被判定为无关而滤掉的条数（这是**结论**，不是失败）
 * @param {number} r.llmErrors       拿不到判定的条数
 * @param {boolean} r.digestAttempted 本轮是否尝试生成简报（有新增才会尝试）
 * @param {boolean} r.digestWritten   简报是否真的写进了 Firestore
 * @returns {{ok: boolean, reasons: string[]}}
 */
function runHealth({
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

  // 一条都没判成功、也没有任何产出：即使没报错也不该算成功轮次。
  if (judged === 0) {
    reasons.push('本轮一条候选都没有处理 —— 信源全挂或抓取被拦');
  }

  return { ok: reasons.length === 0, reasons };
}

module.exports = { runHealth, LLM_ERROR_RATIO_LIMIT };
