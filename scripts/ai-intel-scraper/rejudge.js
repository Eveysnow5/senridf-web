// 纯逻辑：旁路库 ai_intel_rejected 里的条目该不该重新判定。无 Firebase。
//
// 修的是什么：一次 30 秒超时会把文章永久踢出情报流。原流程是
// 判定失败 → 写进旁路库 → 以后每一轮去重都命中它 → 它从没被真正判定过，却再也不会被判定。
// 2026-08-16 那轮 4 条（静冈市役所 AI 窗口实证、埼玉县机器人安全规格研讨会等）就这样没了，
// 而 workflow 是绿的、报表只写了个数字。
//
// 判据：**模型做出了判断才是结论**。filtered_out = 模型看过并说不相关，永久有效；
// llm_error / bad_json = 我们压根没拿到判断，应当重判。
// ⚠️ 特别是额度耗尽：那种夜里整轮剩余条目会全部失败，若按永久处理，
// 等于一次额度见底就静默删掉那一周的全部情报摄入。
//
// 上限的意义：永远判不出的条目（比如内容本身让模型稳定输出坏 JSON）
// 不能每周都烧一次调用，到顶即转永久。
//
// 重判的爆炸半径天然有界：只有**仍出现在本轮 feed 里**的条目才会走到去重这一步，
// 几周前的旧条目早已不在 RSS 里，不会被翻出来重判。

const MAX_JUDGE_ATTEMPTS = 3;

// 模型给出了判断的 reason，永不重判。
const PERMANENT_REASONS = ['filtered_out'];

// 老数据没有 attempts 字段（本次改动之前写入的），按"已判过 1 次"计。
// 这样 2026-08-16 那 4 条会在下一轮自动被重新判定，不需要单独的补捞脚本。
function attemptsOf(rejected) {
  const n = rejected?.attempts;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function shouldRejudge(rejected, maxAttempts = MAX_JUDGE_ATTEMPTS) {
  if (!rejected) return false;
  if (PERMANENT_REASONS.includes(rejected.reason)) return false;
  return attemptsOf(rejected) < maxAttempts;
}

module.exports = { MAX_JUDGE_ATTEMPTS, PERMANENT_REASONS, attemptsOf, shouldRejudge };
