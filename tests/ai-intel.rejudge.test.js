const { test } = require('node:test');
const assert = require('node:assert');
const {
  MAX_JUDGE_ATTEMPTS,
  attemptsOf,
  shouldRejudge,
} = require('../scripts/ai-intel-scraper/rejudge');

// 核心判据：模型做出了判断才是结论。
test('shouldRejudge：filtered_out 是模型的判断，永不重判', () => {
  assert.equal(shouldRejudge({ reason: 'filtered_out', attempts: 1 }), false);
  assert.equal(shouldRejudge({ reason: 'filtered_out' }), false);
});

test('shouldRejudge：超时/坏 JSON 是"没拿到判断"，要重判', () => {
  assert.equal(shouldRejudge({ reason: 'llm_error', attempts: 1 }), true);
  assert.equal(shouldRejudge({ reason: 'bad_json', attempts: 1 }), true);
});

// 这条直接对应 2026-08-16 那 4 条被永久踢出情报流的文章：
// 它们是本次改动之前写入的，没有 attempts 字段。
test('shouldRejudge：老数据没有 attempts 字段时仍会被重判', () => {
  assert.equal(shouldRejudge({ reason: 'llm_error' }), true);
  assert.equal(attemptsOf({ reason: 'llm_error' }), 1);
});

test('shouldRejudge：到达次数上限后转永久，不再每周烧调用', () => {
  assert.equal(shouldRejudge({ reason: 'llm_error', attempts: MAX_JUDGE_ATTEMPTS - 1 }), true);
  assert.equal(shouldRejudge({ reason: 'llm_error', attempts: MAX_JUDGE_ATTEMPTS }), false);
  assert.equal(shouldRejudge({ reason: 'llm_error', attempts: MAX_JUDGE_ATTEMPTS + 5 }), false);
});

test('MAX_JUDGE_ATTEMPTS 是有限小数值——上限没了就等于每周重烧', () => {
  assert.ok(Number.isFinite(MAX_JUDGE_ATTEMPTS));
  assert.ok(MAX_JUDGE_ATTEMPTS >= 2 && MAX_JUDGE_ATTEMPTS <= 5);
});

test('attemptsOf：脏数据一律回落成 1，不能算成 0 让上限失效', () => {
  assert.equal(attemptsOf({ attempts: 0 }), 1);
  assert.equal(attemptsOf({ attempts: -3 }), 1);
  assert.equal(attemptsOf({ attempts: 'two' }), 1);
  assert.equal(attemptsOf({ attempts: NaN }), 1);
  assert.equal(attemptsOf({}), 1);
  assert.equal(attemptsOf(null), 1);
});

test('shouldRejudge：空值不重判（查不到就是没这条，走正常判定）', () => {
  assert.equal(shouldRejudge(null), false);
  assert.equal(shouldRejudge(undefined), false);
});

// 额度耗尽那一夜，整轮剩余条目会全部失败。若它们被当成永久结论，
// 等于一次额度见底就静默删掉那一周的全部情报摄入。
test('shouldRejudge：额度耗尽整批失败的条目仍可救回', () => {
  const batch = Array.from({ length: 30 }, () => ({ reason: 'llm_error', attempts: 1 }));
  assert.equal(
    batch.every((x) => shouldRejudge(x)),
    true,
  );
});
