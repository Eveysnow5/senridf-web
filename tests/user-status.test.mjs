import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUserStatus, userDocUrl } from '../functions/api/_lib/userStatus.js';

// getUserStatus 读 users/{uid}.status。它 known:false 时，准入策略会 fail-open（放行），
// 所以**把 URL 拼错导致每次都 known:false = 审核检查静默失效**。第一条就钉这个。
// （对应 rateLimiter 那个"传成 URL 而非资源名，静默六周"的同类事故。）

test('★ 读的是完整 https 端点，不是资源名（拼错会让审核检查静默失效）', () => {
  const u = userDocUrl('abc123');
  assert.ok(u.startsWith('https://firestore.googleapis.com/'), `必须是 https 端点：${u}`);
  assert.ok(u.includes('/documents/users/abc123'), `路径要落在 users 下：${u}`);
});

test('uid 做 URL 编码（含特殊字符也不破坏路径）', () => {
  assert.ok(userDocUrl('a/b').includes('a%2Fb'));
});

function fetchReturning(impl) {
  return async () => impl;
}

test('approved 正常读出', async () => {
  const r = await getUserStatus(
    'u1',
    't',
    fetchReturning({
      ok: true,
      status: 200,
      json: async () => ({ fields: { status: { stringValue: 'approved' } } }),
    }),
  );
  assert.deepEqual(r, { known: true, status: 'approved' });
});

test('文档不存在(404) → known:true, status:null（交给策略判未审核）', async () => {
  const r = await getUserStatus('u1', 't', fetchReturning({ ok: false, status: 404 }));
  assert.deepEqual(r, { known: true, status: null });
});

test('★ 其他错误(权限/5xx) → known:false（让策略 fail-open，不是误判成 pending）', async () => {
  const r = await getUserStatus(
    'u1',
    't',
    fetchReturning({ ok: false, status: 500, text: async () => 'boom' }),
  );
  assert.equal(r.known, false);
});

test('★ fetch 抛异常 → known:false（不抛给上层）', async () => {
  const throwing = async () => {
    throw new Error('network');
  };
  const r = await getUserStatus('u1', 't', throwing);
  assert.equal(r.known, false);
});

test('文档有但没有 status 字段 → known:true, status:null', async () => {
  const r = await getUserStatus(
    'u1',
    't',
    fetchReturning({ ok: true, status: 200, json: async () => ({ fields: {} }) }),
  );
  assert.deepEqual(r, { known: true, status: null });
});
