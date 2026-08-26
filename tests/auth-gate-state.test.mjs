import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGateState } from '../js/shared/auth-gate-state.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 2026-08-26 线上事故 ────────────────────────────────────────────────────
// japanese_learner 在**默认 Firebase app** 上调了 signInAnonymously。同源所有页面
// 共用默认 app 的会话，于是别的（有门控的）工具页拿到的 user 是个**匿名但 truthy**
// 的对象 → 门控不跳登录页 → 直接读 users/{uid} → 规则要 isMember()，匿名被拒 →
// 抛错 → 页面渲染成"出错了"，**而且再也回不到登录页**。作者登出后就彻底进不去了。
//
// 两道锁，缺一不可：判定层不认匿名（下面第一条），调用层不许污染默认 app（第二条）。

test('★ 匿名身份等同未登录 —— "user 非空就是真用户"这个假设必须在判定层就不成立', () => {
  assert.equal(resolveGateState({ user: { isAnonymous: true } }), 'guest');
  // 匿名身份即使碰巧命中管理员邮箱表也不行（匿名没有 email，但别让实现依赖这一点）
  assert.equal(
    resolveGateState({ user: { isAnonymous: true }, isAdminUser: true, status: 'approved' }),
    'guest',
  );
  // 反向对照：真实用户不受影响，否则"一律返回 guest"也能让上面两条通过
  assert.equal(resolveGateState({ user: { isAnonymous: false }, isAdminUser: true }), 'admin');
  assert.equal(
    resolveGateState({ user: {}, isAdminUser: false, status: 'approved' }),
    'approved',
    'isAnonymous 缺失时按真实用户处理（Firebase 一定会带这个字段，缺了说明不是 Firebase 的 user）',
  );
});

test('★ 除 tracking.js 外，任何用默认 app 的文件都不许调 signInAnonymously', () => {
  const files = [
    ...globSync('js/**/*.js', { cwd: ROOT }),
    ...globSync('solutions/**/*.html', { cwd: ROOT }),
    ...globSync('*.html', { cwd: ROOT }),
  ];
  assert.ok(files.length >= 10, `只扫到 ${files.length} 个文件，扫描范围塌了`);

  const offenders = [];
  let sawTracking = false;
  for (const f of files) {
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    // 注释里提这个词是允许的（事故说明就写在注释里），只看**调用**
    if (!/signInAnonymously\s*\(/.test(src)) continue;
    if (f.replace(/\\/g, '/') === 'js/tracking.js') {
      sawTracking = true; // 它用具名 app（initializeApp(config, 'tracking')），会话隔离
      continue;
    }
    offenders.push(f);
  }
  assert.ok(sawTracking, '护栏自身有效性：没扫到 js/tracking.js 里的那处调用，说明扫描范围不对');
  assert.deepEqual(
    offenders,
    [],
    `这些文件在默认 app 上建匿名会话，会让有门控的页面卡在"出错了"：\n${offenders.join('\n')}\n` +
      `访问统计要匿名身份的话，用 /js/tracking.js（具名 app）。`,
  );
});

test('js/tracking.js 必须用具名 app —— 它是唯一被允许建匿名会话的地方', () => {
  const src = readFileSync(path.join(ROOT, 'js', 'tracking.js'), 'utf8');
  assert.match(
    src,
    // 尾逗号是 prettier 加的（'tracking',\n)），别把它漏掉
    /initializeApp\([\s\S]*?,\s*['"]tracking['"]\s*,?\s*\)/,
    'tracking.js 没有用具名 app —— 它一旦落到默认 app 上，全站门控都会被匿名会话卡住',
  );
});

test('resolveGateState：未登录返回 guest', () => {
  assert.equal(resolveGateState({ user: null, isAdminUser: false, status: undefined }), 'guest');
});

test('resolveGateState：管理员优先于其他状态，返回 admin', () => {
  assert.equal(resolveGateState({ user: {}, isAdminUser: true, status: 'pending' }), 'admin');
  assert.equal(resolveGateState({ user: {}, isAdminUser: true, status: undefined }), 'admin');
});

test('resolveGateState：非管理员 + approved 返回 approved', () => {
  assert.equal(resolveGateState({ user: {}, isAdminUser: false, status: 'approved' }), 'approved');
});

test('resolveGateState：非管理员 + disabled 返回 disabled', () => {
  assert.equal(resolveGateState({ user: {}, isAdminUser: false, status: 'disabled' }), 'disabled');
});

test('resolveGateState：非管理员 + pending 或未知状态 一律返回 pending', () => {
  assert.equal(resolveGateState({ user: {}, isAdminUser: false, status: 'pending' }), 'pending');
  assert.equal(resolveGateState({ user: {}, isAdminUser: false, status: undefined }), 'pending');
  assert.equal(
    resolveGateState({ user: {}, isAdminUser: false, status: 'some_unknown_value' }),
    'pending',
  );
});
