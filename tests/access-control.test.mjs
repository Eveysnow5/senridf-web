import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessDecision } from '../functions/api/_lib/accessControl.js';

// /api/* 准入策略。守两个 2026-09-11 修的洞：
//   ① 匿名 token 能过后端（站点给每个访客都做了匿名登录）→ 任何人都能调烧钱端点
//   ② 会员审核只在前端判，后端不查 → 注册未审核也能绕过界面调 API
// 判据错在这里的后果不是报错，是**钱在漏**或**未审核的人在用**，所以穷举测。

test('★ 匿名一律拒（主洞）', () => {
  const d = accessDecision({
    provider: 'anonymous',
    isAdmin: false,
    statusKnown: true,
    status: 'approved',
  });
  assert.equal(d.ok, false);
  assert.equal(d.code, 403);
  // 即便 status=approved、即便 statusKnown，匿名也必须拒 —— 匿名分支要在最前
});

test('★ provider 缺失也当匿名拒（token 没这个字段时不能放行）', () => {
  assert.equal(
    accessDecision({ provider: null, isAdmin: false, statusKnown: true, status: 'approved' }).ok,
    false,
  );
  assert.equal(
    accessDecision({ provider: undefined, isAdmin: false, statusKnown: true, status: 'approved' })
      .ok,
    false,
  );
});

test('管理员放行，且不要求 users 文档 / status', () => {
  // 管理员可能压根没有 users 文档 —— statusKnown:false 也要放行
  const d = accessDecision({
    provider: 'password',
    isAdmin: true,
    statusKnown: false,
    status: null,
  });
  assert.equal(d.ok, true);
});

test('★ 管理员判断在匿名之后 —— 匿名的管理员邮箱不存在，但要防串位', () => {
  // 万一 isAdmin 误判为 true 而 provider 是匿名，匿名分支必须先拦下
  const d = accessDecision({
    provider: 'anonymous',
    isAdmin: true,
    statusKnown: true,
    status: 'approved',
  });
  assert.equal(d.ok, false, '匿名必须在管理员之前被拦');
});

test('非匿名 + approved → 放行', () => {
  assert.equal(
    accessDecision({ provider: 'password', isAdmin: false, statusKnown: true, status: 'approved' })
      .ok,
    true,
  );
});

test('★ pending / disabled / null → 拒，且文案区分', () => {
  const pending = accessDecision({
    provider: 'password',
    isAdmin: false,
    statusKnown: true,
    status: 'pending',
  });
  assert.equal(pending.ok, false);
  assert.match(pending.error, /審?核|审核/);

  const disabled = accessDecision({
    provider: 'password',
    isAdmin: false,
    statusKnown: true,
    status: 'disabled',
  });
  assert.equal(disabled.ok, false);
  assert.match(disabled.error, /停用/);

  // status 读到了但没有值（文档不存在）→ 按未审核拒
  const nullStatus = accessDecision({
    provider: 'password',
    isAdmin: false,
    statusKnown: true,
    status: null,
  });
  assert.equal(nullStatus.ok, false);
});

test('★ 审核状态读失败 → fail-open（放行），但仅限非匿名', () => {
  // 理由见 accessControl.js 文件头：主洞已由匿名分支堵死，且仍受限流；
  // fail-close 会让一次 Firestore 抖动关掉所有人所有工具。
  const d = accessDecision({
    provider: 'password',
    isAdmin: false,
    statusKnown: false,
    status: null,
  });
  assert.equal(d.ok, true, '非匿名 + 读失败应放行');

  // 但读失败对匿名不适用 —— 匿名仍然拒
  const anon = accessDecision({
    provider: 'anonymous',
    isAdmin: false,
    statusKnown: false,
    status: null,
  });
  assert.equal(anon.ok, false, '匿名即使读失败也必须拒');
});

test('被拒时都带 403 和非空文案（前端要能显示原因）', () => {
  for (const c of [
    { provider: 'anonymous', isAdmin: false, statusKnown: true, status: 'approved' },
    { provider: 'password', isAdmin: false, statusKnown: true, status: 'pending' },
    { provider: 'password', isAdmin: false, statusKnown: true, status: 'disabled' },
  ]) {
    const d = accessDecision(c);
    assert.equal(d.ok, false);
    assert.equal(d.code, 403);
    assert.ok(typeof d.error === 'string' && d.error.length > 0, `文案为空：${JSON.stringify(c)}`);
  }
});
