const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parseArgs, planWeek, WEEK_RE } = require('../scripts/ai-intel-scraper/rebuild-digest');

// 主流程只在「本轮有新增」时生成简报，而且只生成**当前那一周**的。
// 于是 2026-08 出现了一个洞：W32~W34 三周各因不同原因没生成
// （103×403 / 简报 60 秒超时 / 49×403），条目却大多已经入库 ——
// **素材在、摘要没有**，而下周跑的是下周的，洞不会自己长回来。
const ROOT = path.join(__dirname, '..');

test('周次格式必须是 YYYY-Www —— 拼错了会去查一个空集合，然后"什么都没有"', () => {
  for (const good of ['2026-W01', '2026-W34', '2025-W52']) {
    assert.ok(WEEK_RE.test(good), `应接受 ${good}`);
  }
  for (const bad of ['2026-W1', '2026W34', '26-W34', '2026-w34', '2026-W034', 'W34']) {
    assert.ok(!WEEK_RE.test(bad), `不该接受 ${bad}`);
  }
});

test('parseArgs：单周、多周、apply 开关', () => {
  assert.deepEqual(parseArgs(['--week', '2026-W34']), { weeks: ['2026-W34'], apply: false });
  assert.deepEqual(parseArgs(['--weeks', '2026-W33,2026-W34', '--apply']), {
    weeks: ['2026-W33', '2026-W34'],
    apply: true,
  });
  // 逗号周围的空格是手输时的常态
  assert.deepEqual(parseArgs(['--weeks', ' 2026-W33 , 2026-W34 ']).weeks, ['2026-W33', '2026-W34']);
});

// ★ 会烧额度的脚本，危险的那一侧不能是默认。这条是招标回填那边定下的规矩。
test('★ 默认 dry-run —— 不加 --apply 不写库', () => {
  assert.equal(parseArgs(['--week', '2026-W34']).apply, false);
  assert.equal(parseArgs(['--weeks', '2026-W33']).apply, false);
});

test('参数缺失或格式错要报错，而不是默默跑一个空集合', () => {
  assert.match(parseArgs([]).error, /必须指定/);
  assert.match(parseArgs(['--week']).error, /周次/);
  assert.match(parseArgs(['--week', '2026-W1']).error, /格式/);
  assert.match(parseArgs(['--weeks', '2026-W33,坏的']).error, /格式/);
});

// planWeek 把三种情况分开，因为处理方式完全不同。
test('库里一条都没有 → 跳过（W32 就是这样，那周 103 条全判定失败）', () => {
  const p = planWeek({ week: '2026-W32', itemCount: 0, existing: null });
  assert.equal(p.action, 'skip');
  assert.match(p.why, /一条都没有|无米下锅/);
});

test('缺简报且有素材 → 重建（W33 / W34 就是这样）', () => {
  const p = planWeek({ week: '2026-W33', itemCount: 15, existing: null });
  assert.equal(p.action, 'rebuild');
  assert.match(p.why, /15/);
});

test('已有简报且条目数一致 → 跳过，不重复烧额度', () => {
  const p = planWeek({
    week: '2026-W31',
    itemCount: 43,
    existing: { item_count: 43, citation_ok: true },
  });
  assert.equal(p.action, 'skip');
  assert.match(p.why, /不重复烧额度/);
});

// 积压条目被重判捞回来之后，那一周的素材会变多 —— 旧简报就漏了新捞回的内容。
test('已有简报但素材变多 → 重建', () => {
  const p = planWeek({
    week: '2026-W33',
    itemCount: 28,
    existing: { item_count: 15, citation_ok: true },
  });
  assert.equal(p.action, 'rebuild');
  assert.match(p.why, /15 → 28/);
});

test('已有简报但引用校验没过 → 重建（那份本来就该重做）', () => {
  const p = planWeek({
    week: '2026-W34',
    itemCount: 19,
    existing: { item_count: 19, citation_ok: false },
  });
  assert.equal(p.action, 'rebuild');
});

// ── 接线 ──────────────────────────────────────────────────────────────────
test('重建时也关掉思考模式（跟主流程同一条规矩）', () => {
  const s = readFileSync(
    path.join(ROOT, 'scripts', 'ai-intel-scraper', 'rebuild-digest.js'),
    'utf8',
  );
  assert.match(s, /^\s*enable_thinking: false,/m, '漏了就又是一次 60 秒超时');
});

// 补建的和当周自动生成的要能分辨：看历史时，"这份是事后补的"是重要信息。
test('补建的简报要留下 rebuilt_at 标记，界面据此提示', () => {
  const s = readFileSync(
    path.join(ROOT, 'scripts', 'ai-intel-scraper', 'rebuild-digest.js'),
    'utf8',
  );
  assert.match(s, /rebuilt_at:/, '脚本没写补建标记');
  const ui = readFileSync(path.join(ROOT, 'solutions', 'demo', 'ai-intel.html'), 'utf8');
  assert.match(ui, /d\.rebuilt_at/, '界面没有区分补建与当周生成');
});

// 2026-08-25 作者问「之前几周的记录在哪里」，一半答案就是这个 limit(1)：
// 历史简报一直在库里，只是界面没有入口。
test('界面能翻历史周次，不再只显示最新一期', () => {
  const ui = readFileSync(path.join(ROOT, 'solutions', 'demo', 'ai-intel.html'), 'utf8');
  assert.doesNotMatch(
    ui,
    /ai_intel_digest'\),\s*orderBy\('week', 'desc'\),\s*limit\(1\)/,
    '又退回只取最新一期了',
  );
  assert.match(ui, /aiIntelWeek/, '缺少周次选择器');
  assert.match(ui, /loadAiIntelDigest\(sel\.value\)/, '选择器没有接上加载函数');
});

test('workflow 存在，且默认不写库', () => {
  const wf = readFileSync(
    path.join(ROOT, '.github', 'workflows', 'rebuild-ai-intel-digest.yml'),
    'utf8',
  );
  assert.match(wf, /workflow_dispatch/, '应当只手动触发 —— 它会烧额度');
  assert.doesNotMatch(wf, /schedule:/, '不该有定时');
  assert.match(wf, /default: false/, 'apply 的默认值必须是 false');
  assert.match(wf, /github\.repository == 'sherlockafa007\/senridoufuu-web'/, '缺少源仓库守卫');
});
