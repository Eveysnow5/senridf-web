import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from '../functions/api/_lib/rateLimiter.js';

// 2026-09-11：限流从 fail-open 改成 fail-close。它护的是钱——限流器自己坏了就该拦，
// 不是放行。2026-07~08 的 fail-open + 静默 bug 让限流六周形同虚设。
// 这套用可注入的 fetch 直接验各条失败路径的取向。

const TOKEN = 'fake-id-token';

function fetchReturning({ ok, status = 200, count = 1 }) {
  return async () => ({
    ok,
    status,
    text: async () => 'err body',
    json: async () => ({
      writeResults: [{ transformResults: [{ integerValue: String(count) }] }],
    }),
  });
}

test('正常 + 未超限 → 放行（false）', async () => {
  const blocked = await checkRateLimit('u1', TOKEN, fetchReturning({ ok: true, count: 5 }));
  assert.equal(blocked, false);
});

test('正常 + 超过 120 → 拦（true）', async () => {
  const blocked = await checkRateLimit('u1', TOKEN, fetchReturning({ ok: true, count: 121 }));
  assert.equal(blocked, true);
});

test('恰好 120 不拦，121 才拦（边界）', async () => {
  assert.equal(await checkRateLimit('u1', TOKEN, fetchReturning({ ok: true, count: 120 })), false);
  assert.equal(await checkRateLimit('u1', TOKEN, fetchReturning({ ok: true, count: 121 })), true);
});

test('★ Firestore 回非 2xx → 拦（fail-close，不是放行）', async () => {
  const blocked = await checkRateLimit('u1', TOKEN, fetchReturning({ ok: false, status: 400 }));
  assert.equal(blocked, true, 'commit 失败必须拦，护钱');
});

test('★ fetch 抛异常（网络断）→ 拦（fail-close）', async () => {
  const throwing = async () => {
    throw new Error('network down');
  };
  const blocked = await checkRateLimit('u1', TOKEN, throwing);
  assert.equal(blocked, true, '异常时必须拦，不能像以前那样放行');
});
