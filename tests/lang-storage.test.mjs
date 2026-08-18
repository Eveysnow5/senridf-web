import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 站点的语言选择只应该有**一个**存储键。曾经有两个：main.js 用 sdf_lang，
// japanese_learner 用自己的 jl_lang——于是在一处切了语言，另一处不跟着变，
// 而且两边都"看起来正常"，只有同时打开才会发现不一致。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JL = readFileSync(path.join(ROOT, 'solutions', 'demo', 'japanese_learner.html'), 'utf8');
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

test('护栏自身有效：读到了两个文件', () => {
  assert.ok(JL.length > 10000 && MAIN.length > 10000);
});

test('站点语言键只有 sdf_lang 一个写入源', () => {
  assert.match(MAIN, /localStorage\.setItem\('sdf_lang'/);
  assert.match(JL, /localStorage\.setItem\('sdf_lang'/);
  // 旧键只允许出现在"读取旧值做迁移"和"清掉它"两处，不允许再被写入
  assert.doesNotMatch(JL, /localStorage\.setItem\('jl_lang'/, 'jl_lang 不该再被写入');
});

test('japanese_learner 会读站点语言，也认 ?lang=', () => {
  assert.match(JL, /localStorage\.getItem\('sdf_lang'\)/);
  assert.match(JL, /URLSearchParams\(location\.search\)\.get\('lang'\)/);
});

test('切换语言时会清掉旧键，避免两个源各自漂移', () => {
  assert.match(JL, /localStorage\.removeItem\('jl_lang'\)/);
});

test('语言值经过白名单校验（脏值不该被写进存储）', () => {
  assert.match(JL, /VALID_LANGS\s*=\s*\['ja', 'zh', 'en'\]/);
  assert.match(JL, /if \(!VALID_LANGS\.includes\(l\)\) return;/);
});
