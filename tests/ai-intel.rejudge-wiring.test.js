const { test } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');

// 结构护栏，不是行为测试。
// index.js 是 IO+main（要 Firebase 与网络），重判分支的真实行为只能靠线上那轮证明。
// 这里守的是"这几行别在以后的编辑里被悄悄改回去"——2026-08-16 那个 bug 的形态正是
// 一条看起来合理的去重语句，把从没判定过的条目永久排除掉。
const SRC = readFileSync(
  path.join(__dirname, '..', 'scripts', 'ai-intel-scraper', 'index.js'),
  'utf8',
);

test('护栏自身有效：源文件读到了且不是空的', () => {
  assert.ok(SRC.length > 2000, `index.js 只读到 ${SRC.length} 字符，护栏形同虚设`);
  assert.match(SRC, /ai_intel_rejected/);
});

test('旁路库命中时必须经过 shouldRejudge，不能无条件跳过', () => {
  assert.match(SRC, /require\('\.\/rejudge'\)/);
  assert.match(SRC, /shouldRejudge\(/);
  // 老代码的形态：查到旁路库有记录就直接 skipped_dup++ 然后 continue。
  const badPattern = /dupRej\.empty\)\s*\{\s*totals\.skipped_dup\+\+;\s*continue;/s;
  assert.doesNotMatch(SRC, badPattern, '旁路库命中被无条件跳过——正是要修的那个 bug');
});

test('重判失败要更新原条目而不是新增（否则 attempts 计数失真）', () => {
  assert.match(SRC, /rejectedRef\.set\(record, \{ merge: true \}\)/);
  assert.match(SRC, /attempts: priorAttempts \+ 1/);
});

test('重判成功要删掉旁路库里那条', () => {
  assert.match(SRC, /rejectedRef\.delete\(\)/);
  assert.match(SRC, /totals\.recovered\+\+/);
});

test('判定走带重试的路径，用量要进日志和运行报表', () => {
  assert.match(SRC, /judgeWithRetry\(item\)/);
  assert.match(SRC, /formatUsage\(usageAcc\)/);
  assert.match(SRC, /usage: usageAcc/);
});
