import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 复盘①：对抗性测试常态化 —— 钉住「那道门的牙齿」。
//
// ── 为什么这样做 ────────────────────────────────────────────────────────────
// 实测：7 个 /api 端点**没有一个自己做鉴权**（都不读 context.data.user），认证完全
// 集中在 _middleware.js 一处。所以「每个端点一条对抗测试」在这个架构下收敛成
// 「守住那一处 choke point + 别让新端点绕过它」。
//
// access-control.test.mjs 已经测了准入**逻辑**（匿名/pending/过期…）。这里补两件它不管的：
//   ① _middleware 真的还在调那三道检查（拒匿名 / 限流 / 查审核）——
//      谁编辑 middleware 时把某道删了，这里红。逻辑测试测不到「调用被删」。
//   ② 端点没有自己重新实现一套（更松的）鉴权，绕过中心门。
//
// ⚠️ 这类护栏是「查存在」——断言某段调用在源码里。所以每条都配一句"删了它会怎样"，
//    并且断言的是**调用**不是注释（防止有人把调用改成注释还绿）。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'functions', 'api');

const middleware = readFileSync(path.join(API_DIR, '_middleware.js'), 'utf8');

// 去掉行注释，避免"注释里出现某调用"骗过断言。
const mwCode = middleware.replace(/\/\/.*$/gm, '');

test('★ _middleware 拒匿名（删了它，任何访客的匿名 token 都能过）', () => {
  assert.match(
    mwCode,
    /provider\s*===\s*['"]anonymous['"]/,
    '_middleware 不再检查 provider==="anonymous" —— 匿名拦截没了',
  );
  // 匿名判断必须真的触发一个拒绝（return），不是判完不用
  assert.match(mwCode, /anonymous[\s\S]{0,200}?return/, '匿名分支没有 return 拒绝');
});

test('★ _middleware 调了限流（删了它，烧钱端点不再限流）', () => {
  assert.match(mwCode, /checkRateLimit\s*\(/, '_middleware 不再调 checkRateLimit');
});

test('★ _middleware 调了审核状态检查（删了它，pending 用户能用工具）', () => {
  assert.match(mwCode, /getUserStatus\s*\(/, '_middleware 不再调 getUserStatus');
  assert.match(mwCode, /accessDecision\s*\(/, '_middleware 不再调 accessDecision');
});

test('★ _middleware 验了 token（删了它，伪造 token 能过）', () => {
  assert.match(mwCode, /verifyFirebaseToken\s*\(/, '_middleware 不再调 verifyFirebaseToken');
});

/** 列出真正的端点文件（排除 _middleware 和 _lib）。 */
function endpointFiles() {
  return readdirSync(API_DIR).filter((f) => f.endsWith('.js') && f !== '_middleware.js');
}

test('护栏自身有效：真的扫到了端点', () => {
  const eps = endpointFiles();
  assert.ok(eps.length >= 5, `只扫到 ${eps.length} 个端点，多半漏了`);
});

test('★ 没有端点自己重新实现鉴权（绕过中心门）', () => {
  // 端点应当信任 _middleware —— 通过 context.data.user 拿身份，
  // 不应自己 verifyFirebaseToken / 自己解析 Authorization 头去做**更松**的判断。
  // 端点里出现这些 = 有人在中心门之外另开了一套，要人工审。
  const offenders = [];
  for (const f of endpointFiles()) {
    const src = readFileSync(path.join(API_DIR, f), 'utf8').replace(/\/\/.*$/gm, '');
    if (/verifyFirebaseToken\s*\(/.test(src)) {
      offenders.push(`${f}: 自己调 verifyFirebaseToken —— 鉴权应集中在 _middleware`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `${offenders.join('\n')}\n（若确有正当理由，改这条测试并说明——但先想清楚为什么不走中心门）`,
  );
});

test('★ 拒绝顺序：匿名判断在调用 context.next() 之前（不能先放行再检查）', () => {
  const anonIdx = mwCode.search(/provider\s*===\s*['"]anonymous['"]/);
  const nextIdx = mwCode.search(/context\.next\s*\(/);
  assert.ok(anonIdx > 0, '找不到匿名判断');
  assert.ok(nextIdx > 0, '找不到 context.next()');
  assert.ok(anonIdx < nextIdx, '匿名判断跑在 context.next() 之后 —— 等于先放行再检查');
});
