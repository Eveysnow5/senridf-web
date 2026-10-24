// 登录失败要说出真实原因（2026-10-24，Yuki「登录不进去」时所有页面都只说「邮箱或密码错误」）。
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loginErrorKind, loginErrorText } from '../js/shared/auth-errors.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Firebase 错误码 → 原因分开', () => {
  assert.equal(loginErrorKind({ code: 'auth/invalid-credential' }), 'wrong');
  assert.equal(loginErrorKind({ code: 'auth/too-many-requests' }), 'locked');
  assert.equal(loginErrorKind({ code: 'auth/user-disabled' }), 'disabled');
  assert.equal(loginErrorKind({ code: 'auth/network-request-failed' }), 'network');
  assert.equal(loginErrorKind(null), 'other');
  assert.match(loginErrorText({ code: 'auth/too-many-requests' }), /锁住/);
  // 没见过的码原样带出来：用户截图给我们就知道是什么
  assert.match(loginErrorText({ code: 'auth/some-new-code' }), /auth\/some-new-code/);
});

const LOGIN_PAGES = [
  'account.html',
  'admin/accounting.html',
  'admin/blog/index.html',
  'admin/index.html',
  'admin/macro.html',
  'bids/index.html',
  'solutions/demo/admin.html',
  'solutions/demo/ai-intel.html',
];

test('每个登录页都用共享的原因判断，不再把所有失败说成「密码错误」', () => {
  for (const p of LOGIN_PAGES) {
    const s = read(p);
    assert.match(s, /signInWithEmailAndPassword\(auth/, `${p} 不再是登录页？更新这张表`);
    assert.match(s, /from '\/js\/shared\/auth-errors\.js'/, `${p} 没用 auth-errors.js`);
    assert.doesNotMatch(
      s,
      /\} catch \{\s*\n[^\n]*(邮箱或密码|err_login')/,
      `${p} 又把错误吞成了「密码错误」`,
    );
  }
});

test('会员页三语都有分原因的提示', () => {
  const s = read('account.html');
  for (const k of ['err_login_locked', 'err_login_disabled', 'err_login_network']) {
    assert.equal((s.match(new RegExp(`${k}:`, 'g')) || []).length, 3, `${k} 不是三语都有`);
  }
});
