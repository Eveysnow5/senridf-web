const { test } = require('node:test');
const assert = require('node:assert');
const { needsBackfill, parseArgs, DEFAULT_LIMIT } = require('../scripts/bid-scraper/backfill');

// 回填的对象：translate() 失败时条目仍会入库、只是 summary_zh 为空，
// 而主库去重让它此后再也不会被重译 —— 页面上那条招标永远没有中文摘要。
test('缺摘要的条目被选中', () => {
  assert.equal(needsBackfill({ title: 'x' }), true, '压根没有该字段');
  assert.equal(needsBackfill({ title: 'x', summary_zh: '' }), true);
  assert.equal(needsBackfill({ title: 'x', summary_zh: null }), true);
});

// ⚠️ 全是空白的摘要在页面上和空的没区别，不能算"有摘要"。
test('只有空白字符也算缺摘要', () => {
  assert.equal(needsBackfill({ summary_zh: '   ' }), true);
  assert.equal(needsBackfill({ summary_zh: '\n\t ' }), true);
});

test('已有摘要的条目不动（回填不该重写好数据）', () => {
  assert.equal(needsBackfill({ summary_zh: '【内容】某某采购' }), false);
});

// 否则每次回填都会把同一批垃圾页重判一遍，白烧额度。
test('已标记 NOT_A_BID 的不再重试', () => {
  assert.equal(needsBackfill({ summary_zh: '', summary_skipped: 'NOT_A_BID' }), false);
});

test('脏输入不炸', () => {
  for (const v of [null, undefined, 'string', 42]) assert.equal(needsBackfill(v), false);
});

/* ── 参数：这个脚本会烧额度，默认必须是安全的那一侧 ──────────────────────── */

test('默认 dry-run，不写库不调用 LLM', () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(['--limit', '5']).apply, false, '只给 limit 不该触发真跑');
});

test('要真跑必须显式 --apply', () => {
  assert.equal(parseArgs(['--apply']).apply, true);
});

test('默认有条数上限，不会一口气把额度喝干', () => {
  assert.equal(parseArgs(['--apply']).limit, DEFAULT_LIMIT);
  assert.ok(DEFAULT_LIMIT > 0 && DEFAULT_LIMIT <= 50, `上限 ${DEFAULT_LIMIT} 不合理`);
});

test('limit 脏值回落到默认值，不会变成 0 或 NaN', () => {
  for (const bad of [['--limit', 'abc'], ['--limit', '-3'], ['--limit', '0'], ['--limit']]) {
    assert.equal(parseArgs(bad).limit, DEFAULT_LIMIT, bad.join(' '));
  }
  assert.equal(parseArgs(['--limit', '7']).limit, 7);
  assert.equal(parseArgs(['--limit', '3.9']).limit, 3);
});

test('回填复用夜间流程同一个 translate（不能自带一份提示词）', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'scripts', 'bid-scraper', 'backfill.js'),
    'utf8',
  );
  assert.match(src, /require\('\.\/index\.js'\)/, '必须从 index.js 取 translate');
  assert.doesNotMatch(src, /你是一名专业的日中双语翻译助手/, '不许在回填里另写一份提示词');
});
