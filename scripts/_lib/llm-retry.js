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

/**
 * 把 LLM 调用错误变成一句**能定位原因**的话。
 *
 * axios 的 err.message 只有 `Request failed with status code 403` —— 但 403 至少
 * 有四种完全不同的原因：额度用尽（Arrearage）、限流（Throttling）、模型不存在、
 * 密钥无权限。真实原因在**响应体**里，而它一直被丢掉。
 *
 * 代价是实打实的：2026-08-09 起情报爬虫连续三周失败（103×403 / 60s 超时 /
 * 49×403），日志里只有那句通用文案，工作流每次都报 success，
 * **最后是靠作者发现情报页停在 W31 才发现的**。若当时记了响应体，
 * 第一周就能看见"额度用尽"四个字。
 *
 * 截断到 300 字符：DashScope 出错时偶尔回整页 HTML，整段打进日志会淹掉别的行。
 */
function describeCallError(err) {
  if (!err) return 'unknown error';
  const status = err.response?.status ?? err.status;
  const data = err.response?.data;
  const detail = data?.error?.message || data?.message || data?.error?.code || data?.code || '';
  const parts = [];
  if (Number.isFinite(status)) parts.push(`HTTP ${status}`);
  if (detail) parts.push(String(detail).replace(/\s+/g, ' ').slice(0, 300));
  if (!parts.length) parts.push(err.message || String(err));
  return parts.join(' — ');
}

module.exports = { isTransientCallError, retryDelayMs, describeCallError };
