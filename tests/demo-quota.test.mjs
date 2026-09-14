import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_LIMITS,
  isMemberProvider,
  limitsFor,
  checkInputSize,
  quotaDecision,
} from '../functions/api/_lib/demoQuota.js';

// 受発注デモの配額・入力上限（純ロジック）。ここは「いくら無料で使わせるか＝お金」を
// 決める箇所なので、境界をきっちり固める。IO は demoCounters.js（別途）。

test('isMemberProvider：匿名/空は会員でない、それ以外は会員', () => {
  assert.equal(isMemberProvider('password'), true);
  assert.equal(isMemberProvider('google.com'), true);
  assert.equal(isMemberProvider('anonymous'), false);
  assert.equal(isMemberProvider(null), false);
  assert.equal(isMemberProvider(undefined), false);
  assert.equal(isMemberProvider(''), false);
});

test('limitsFor：会員と匿名で上限が違う', () => {
  assert.equal(limitsFor('password').lifetimeUses, 3);
  assert.equal(limitsFor('anonymous').lifetimeUses, 1);
  assert.ok(limitsFor('password').maxChars > limitsFor('anonymous').maxChars);
});

test('checkInputSize：空は 400', () => {
  assert.deepEqual(checkInputSize({ provider: 'anonymous', text: '' }), {
    ok: false,
    code: 400,
    error: 'empty',
  });
});

test('checkInputSize：匿名は 3000 字まで、超えたら 413', () => {
  assert.equal(checkInputSize({ provider: 'anonymous', text: 'x'.repeat(3000) }).ok, true);
  const over = checkInputSize({ provider: 'anonymous', text: 'x'.repeat(3001) });
  assert.equal(over.ok, false);
  assert.equal(over.code, 413);
  assert.equal(over.error, 'too_long');
});

test('checkInputSize：会員は 10000 字まで（匿名なら弾かれる長さも通る）', () => {
  assert.equal(checkInputSize({ provider: 'anonymous', text: 'x'.repeat(5000) }).ok, false);
  assert.equal(checkInputSize({ provider: 'password', text: 'x'.repeat(5000) }).ok, true);
  assert.equal(checkInputSize({ provider: 'password', text: 'x'.repeat(10001) }).error, 'too_long');
});

test('checkInputSize：ページ数上限（匿名1・会員5）', () => {
  assert.equal(checkInputSize({ provider: 'anonymous', text: 'ok', pageCount: 1 }).ok, true);
  assert.equal(
    checkInputSize({ provider: 'anonymous', text: 'ok', pageCount: 2 }).error,
    'too_many_pages',
  );
  assert.equal(checkInputSize({ provider: 'password', text: 'ok', pageCount: 5 }).ok, true);
  assert.equal(
    checkInputSize({ provider: 'password', text: 'ok', pageCount: 6 }).error,
    'too_many_pages',
  );
});

test('★ quotaDecision fail-close：カウンタ不明(null)なら拦（お金を守る）', () => {
  const d = quotaDecision({ provider: 'anonymous', uidCount: null, ipCount: 1, globalCount: 1 });
  assert.equal(d.ok, false);
  assert.equal(d.code, 503);
  assert.equal(d.error, 'counter_unavailable');
  // どれか一つでも null なら拦
  assert.equal(
    quotaDecision({ provider: 'password', uidCount: 1, ipCount: null, globalCount: 1 }).ok,
    false,
  );
  assert.equal(
    quotaDecision({ provider: 'password', uidCount: 1, ipCount: 1, globalCount: null }).ok,
    false,
  );
});

test('★ 匿名はちょうど1回：1回目許可、2回目拒否', () => {
  assert.equal(
    quotaDecision({ provider: 'anonymous', uidCount: 1, ipCount: 1, globalCount: 1 }).ok,
    true,
  );
  const d = quotaDecision({ provider: 'anonymous', uidCount: 2, ipCount: 1, globalCount: 1 });
  assert.equal(d.ok, false);
  assert.equal(d.error, 'anon_used_up');
});

test('★ 会員はちょうど3回：3回目まで許可、4回目拒否', () => {
  assert.equal(
    quotaDecision({ provider: 'password', uidCount: 3, ipCount: 1, globalCount: 1 }).ok,
    true,
  );
  const d = quotaDecision({ provider: 'password', uidCount: 4, ipCount: 1, globalCount: 1 });
  assert.equal(d.ok, false);
  assert.equal(d.error, 'member_used_up');
});

test('★ 全站日次上限 500：500 許可、501 拒否', () => {
  assert.equal(
    quotaDecision({ provider: 'password', uidCount: 1, ipCount: 1, globalCount: 500 }).ok,
    true,
  );
  const d = quotaDecision({ provider: 'password', uidCount: 1, ipCount: 1, globalCount: 501 });
  assert.equal(d.ok, false);
  assert.equal(d.error, 'global_daily');
});

test('★ IP 日次上限 5：5 許可、6 拒否', () => {
  assert.equal(
    quotaDecision({ provider: 'password', uidCount: 1, ipCount: 5, globalCount: 1 }).ok,
    true,
  );
  assert.equal(
    quotaDecision({ provider: 'password', uidCount: 1, ipCount: 6, globalCount: 1 }).error,
    'ip_daily',
  );
});

test('判定順：全站 → IP → uid（全站が先に効く）', () => {
  // 全站も uid も超過 → 先に global_daily が返る
  const d = quotaDecision({ provider: 'anonymous', uidCount: 99, ipCount: 99, globalCount: 501 });
  assert.equal(d.error, 'global_daily');
});

test('護欄の前提：上限値が想定どおり（変えたら気づく）', () => {
  assert.equal(DEMO_LIMITS.anonymous.lifetimeUses, 1);
  assert.equal(DEMO_LIMITS.member.lifetimeUses, 3);
  assert.equal(DEMO_LIMITS.globalDaily, 500);
  assert.equal(DEMO_LIMITS.ipDaily, 5);
});
