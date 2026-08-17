// 纯逻辑：LLM 调用的 token 用量累计与格式化。无网络、无 Firebase。
//
// 存在理由：额度是当前最硬的约束，而 2026-08-13 连续两次证明「估算代替测量」不可靠
// （估 604K 实际 451K；说索引能压到 6K 实际 14K）。用量必须从生产路径本身量，
// 不是从控制台事后推断。两个爬虫共用同一个 1M 桶，所以两边都要接。

function emptyUsage() {
  return {
    calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    missing_usage: 0,
  };
}

function num(v) {
  return Number.isFinite(v) ? v : 0;
}

// 累加一次调用的 usage。
// ⚠️ 字段缺失算 0，但「整体没拿到 usage」单独计数——"没量到"和"量到 0"必须分得开，
// 否则用量报告会把观测盲区伪装成"没有消耗"。
function addUsage(acc, usage) {
  acc.calls++;
  if (!usage || typeof usage !== 'object') {
    acc.missing_usage++;
    return acc;
  }
  const prompt = num(usage.prompt_tokens);
  const completion = num(usage.completion_tokens);
  acc.prompt_tokens += prompt;
  acc.completion_tokens += completion;
  // 推理 token 按 OpenAI 兼容口径是 completion_tokens 的子集，此处照报不重复计入总数。
  acc.reasoning_tokens += num(usage.completion_tokens_details?.reasoning_tokens);
  acc.cached_tokens += num(usage.prompt_tokens_details?.cached_tokens);
  acc.total_tokens += num(usage.total_tokens) || prompt + completion;
  return acc;
}

// 一行用量摘要，进日志也进运行报表。
function formatUsage(acc) {
  if (!acc || acc.calls === 0) return '用量：本轮无 LLM 调用。';
  const per = Math.round(acc.total_tokens / acc.calls);
  const parts = [
    `用量：${acc.calls} 次调用`,
    `输入 ${acc.prompt_tokens} + 输出 ${acc.completion_tokens} = ${acc.total_tokens} token`,
    `平均 ${per}/次`,
  ];
  if (acc.reasoning_tokens > 0) parts.push(`其中推理 ${acc.reasoning_tokens}（计费但被丢弃）`);
  if (acc.cached_tokens > 0) parts.push(`缓存命中 ${acc.cached_tokens}`);
  if (acc.missing_usage > 0) parts.push(`⚠️ ${acc.missing_usage} 次未拿到 usage（下列数字偏低）`);
  return parts.join('，') + '。';
}

module.exports = { emptyUsage, addUsage, formatUsage };
