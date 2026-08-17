const { test } = require('node:test');
const assert = require('node:assert');
const { isTransientCallError, retryDelayMs } = require('../scripts/_lib/llm-retry');

// 这是本次改动的起因：2026-08-16 日志里 4 条一模一样的 axios 超时。
test('isTransientCallError：axios 超时（真实形态）判为瞬时', () => {
  const err = Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' });
  assert.equal(isTransientCallError(err), true);
});

test('isTransientCallError：限流与上游 5xx 判为瞬时', () => {
  assert.equal(isTransientCallError({ response: { status: 429 } }), true);
  assert.equal(isTransientCallError({ response: { status: 500 } }), true);
  assert.equal(isTransientCallError({ response: { status: 503 } }), true);
  assert.equal(isTransientCallError({ response: { status: 408 } }), true);
});

// 额度耗尽立刻重试必然同样失败——它要靠跨轮重判救，不是靠轮内重试。
test('isTransientCallError：额度耗尽/密钥错/请求错不在轮内重试', () => {
  assert.equal(isTransientCallError({ response: { status: 403 } }), false);
  assert.equal(isTransientCallError({ response: { status: 401 } }), false);
  assert.equal(isTransientCallError({ response: { status: 400 } }), false);
});

test('isTransientCallError：网络类 code 判为瞬时', () => {
  for (const code of ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ERR_NETWORK']) {
    assert.equal(isTransientCallError({ code }), true, code);
  }
});

test('isTransientCallError：状态码优先于消息文本', () => {
  // 4xx 的响应体里出现 "timeout" 字样不该让它变成可重试。
  const err = Object.assign(new Error('bad request: timeout param invalid'), {
    response: { status: 400 },
  });
  assert.equal(isTransientCallError(err), false);
});

test('isTransientCallError：空值与无关错误判为非瞬时', () => {
  assert.equal(isTransientCallError(null), false);
  assert.equal(isTransientCallError(undefined), false);
  assert.equal(isTransientCallError(new Error('unexpected token in JSON')), false);
});

test('retryDelayMs：指数退避且封顶 8 秒', () => {
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(2), 2000);
  assert.equal(retryDelayMs(3), 4000);
  assert.equal(retryDelayMs(10), 8000);
  assert.equal(retryDelayMs(0), 1000);
  assert.equal(retryDelayMs(undefined), 1000);
});
