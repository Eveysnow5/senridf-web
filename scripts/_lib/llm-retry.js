// 纯逻辑：LLM 调用失败的瞬时/永久分类与退避间隔。无网络。
//
// 背景：2026-08-16 的情报爬虫日志里 4 条 `timeout of 30000ms exceeded`，
// 每一条都让一篇文章被当作"判定失败"处理。超时是瞬时故障，不是结论。

const TRANSIENT_CODES = new Set([
  'ECONNABORTED', // axios 超时就是这个
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ERR_NETWORK',
]);

// 同一轮内是否值得立刻重试。
// 只认"再试一次可能就好"的：超时、限流、上游 5xx、网络抖动。
// 额度耗尽(403)/密钥错(401)/请求格式错(400) 立刻重试必然同样失败，白烧时间——
// 它们交给跨轮重判处理（下周额度已重置、配置已修好），见 ai-intel-scraper/rejudge.js。
function isTransientCallError(err) {
  if (!err) return false;
  const status = err.response?.status ?? err.status;
  if (Number.isFinite(status)) return status === 408 || status === 429 || status >= 500;
  if (TRANSIENT_CODES.has(err.code)) return true;
  return /timeout|socket hang up|network error/i.test(err.message || '');
}

// 第 n 次重试前等多久（n 从 1 起）。指数退避，封顶 8 秒。
function retryDelayMs(attempt) {
  const n = Number.isFinite(attempt) && attempt > 0 ? attempt : 1;
  return Math.min(1000 * 2 ** (n - 1), 8000);
}

module.exports = { isTransientCallError, retryDelayMs };
