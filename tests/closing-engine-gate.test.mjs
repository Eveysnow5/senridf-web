import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGate } from '../functions/solutions/demo/closing-engine/_middleware.js';

// 月结引擎的代码包只给登录、审核通过的会员（2026-10-14）。判据和 /api/* 相同，这里用假的依赖穷举。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = 'https://www.senridf.com/solutions/demo/closing-engine/jpclose-bundle.zip';

function run(
  url,
  { token, user, status = { known: true, status: 'approved' }, admin = false, bad = false } = {},
) {
  const calls = { verify: 0, next: 0 };
  const gate = makeGate({
    verify: async () => {
      calls.verify++;
      if (bad) throw new Error('bad');
      return user;
    },
    status: async () => status,
    admin: () => admin,
  });
  const headers = new Headers(token ? { Authorization: `Bearer ${token}` } : {});
  const ctx = {
    request: new Request(url, { headers }),
    next: async () => {
      calls.next++;
      return new Response('zip', { headers: { 'Cache-Control': 'public, max-age=14400' } });
    },
  };
  return gate(ctx).then((res) => ({ res, calls }));
}

const MEMBER = { uid: 'u1', provider: 'password' };

test('代码包：会员放行，且不进共享缓存', async () => {
  const { res, calls } = await run(BUNDLE, { token: 't', user: MEMBER });
  assert.equal(res.status, 200);
  assert.equal(calls.next, 1);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
});

test('代码包：没有 token、token 无效、匿名、审核中、停用 → 都拦，且不往下取文件', async () => {
  const cases = [
    [{}, 401],
    [{ token: 't', bad: true }, 401],
    [{ token: 't', user: { uid: 'a', provider: 'anonymous' } }, 403],
    [{ token: 't', user: MEMBER, status: { known: true, status: 'pending' } }, 403],
    [{ token: 't', user: MEMBER, status: { known: true, status: null } }, 403],
    [{ token: 't', user: MEMBER, status: { known: true, status: 'disabled' } }, 403],
  ];
  for (const [opt, code] of cases) {
    const { res, calls } = await run(BUNDLE, opt);
    assert.equal(res.status, code, JSON.stringify(opt));
    assert.equal(calls.next, 0, JSON.stringify(opt));
  }
});

test('代码包：管理员放行；审核状态读失败放行（和 /api/* 同样 fail-open）', async () => {
  assert.equal(
    (
      await run(BUNDLE, {
        token: 't',
        user: MEMBER,
        admin: true,
        status: { known: true, status: 'pending' },
      })
    ).res.status,
    200,
  );
  assert.equal(
    (await run(BUNDLE, { token: 't', user: MEMBER, status: { known: false } })).res.status,
    200,
  );
});

test('换个写法也拦：大小写、% 编码、坏的 % 编码', async () => {
  for (const name of [
    'JPCLOSE-BUNDLE.ZIP',
    'jpclose%2Dbundle.zip',
    'jpclose-bundle%2Ezip',
    'jp%ZZclose-bundle.zip',
  ]) {
    const { res, calls } = await run(
      `https://www.senridf.com/solutions/demo/closing-engine/${name}`,
    );
    assert.equal(res.status, 401, name);
    assert.equal(calls.next, 0, name);
  }
});

test('只拦代码包：模板、wheel、manifest 照常公开（不验 token）', async () => {
  for (const name of [
    'template_ja.xlsx',
    'template.zip',
    'manifest.json',
    'wheels/openpyxl-3.1.5-py2.py3-none-any.whl',
  ]) {
    const { res, calls } = await run(
      `https://www.senridf.com/solutions/demo/closing-engine/${name}`,
    );
    assert.equal(res.status, 200, name);
    assert.equal(calls.verify, 0, name);
  }
});

test('页面每个请求都带登录凭证；Worker 取文件时附上，401/403 报成「要登录」', () => {
  const html = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing.html'), 'utf8');
  const worker = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing-worker.js'), 'utf8');
  assert.match(html, /askOne\(\{ \.\.\.msg, token: await idToken\(\) \}, transfer\)/);
  assert.match(worker, /if \(m\.token\) idToken = m\.token;/);
  assert.match(worker, /Authorization: `Bearer \$\{idToken\}`/);
  assert.match(worker, /r\.status === 401 \|\| r\.status === 403\) throw new AuthError/);
  assert.match(html, /auth: 'ce_err_auth'/);
});
