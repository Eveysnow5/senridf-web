const { test } = require('node:test');
const assert = require('node:assert');
const { emptyUsage, addUsage, formatUsage } = require('../scripts/_lib/llm-usage');

test('addUsage：常规 usage 累计', () => {
  const acc = emptyUsage();
  addUsage(acc, { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 });
  addUsage(acc, { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230 });
  assert.equal(acc.calls, 2);
  assert.equal(acc.prompt_tokens, 300);
  assert.equal(acc.completion_tokens, 50);
  assert.equal(acc.total_tokens, 350);
  assert.equal(acc.missing_usage, 0);
});

// 这是本次接入用量统计的主要目的之一：思考模式到底开没开、烧了多少。
test('addUsage：推理 token 与缓存命中被单独记下', () => {
  const acc = emptyUsage();
  addUsage(acc, {
    prompt_tokens: 500,
    completion_tokens: 400,
    total_tokens: 900,
    completion_tokens_details: { reasoning_tokens: 350 },
    prompt_tokens_details: { cached_tokens: 128 },
  });
  assert.equal(acc.reasoning_tokens, 350);
  assert.equal(acc.cached_tokens, 128);
  // 推理 token 是 completion 的子集，不重复计进总数。
  assert.equal(acc.total_tokens, 900);
});

// "没量到"和"量到 0"必须分得开，否则观测盲区会被报成"没有消耗"。
test('addUsage：整体缺 usage 时单独计数，而不是当成 0 消耗', () => {
  const acc = emptyUsage();
  addUsage(acc, undefined);
  addUsage(acc, null);
  addUsage(acc, 'not an object');
  assert.equal(acc.calls, 3);
  assert.equal(acc.missing_usage, 3);
  assert.equal(acc.total_tokens, 0);
  assert.match(formatUsage(acc), /未拿到 usage/);
});

test('addUsage：缺 total_tokens 时用 prompt+completion 兜底', () => {
  const acc = emptyUsage();
  addUsage(acc, { prompt_tokens: 40, completion_tokens: 60 });
  assert.equal(acc.total_tokens, 100);
});

test('addUsage：脏字段不污染累计值', () => {
  const acc = emptyUsage();
  addUsage(acc, { prompt_tokens: 'abc', completion_tokens: null, total_tokens: NaN });
  assert.equal(acc.calls, 1);
  assert.equal(acc.missing_usage, 0); // 有 usage 对象，只是字段脏
  assert.equal(acc.prompt_tokens, 0);
  assert.equal(acc.total_tokens, 0);
});

test('formatUsage：无调用时说清楚是"没调用"', () => {
  assert.match(formatUsage(emptyUsage()), /无 LLM 调用/);
  assert.match(formatUsage(null), /无 LLM 调用/);
});

test('formatUsage：含调用次数、总量与平均值', () => {
  const acc = emptyUsage();
  addUsage(acc, { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 });
  addUsage(acc, { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 });
  const s = formatUsage(acc);
  assert.match(s, /2 次调用/);
  assert.match(s, /400 token/);
  assert.match(s, /平均 200\/次/);
  // 没有推理/缓存时不该凭空出现这两段
  assert.doesNotMatch(s, /推理/);
  assert.doesNotMatch(s, /缓存/);
});
