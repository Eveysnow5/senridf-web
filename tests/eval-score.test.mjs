// 评估基线的打分逻辑。
//
// 这些测试守的是**尺子本身**：打分器判错，比没有基线更糟——一个会误报的基线会让人
// 开始忽略它，那时它就等于不存在。所以这里的用例大多是"别把对的判成错的"。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractCitations, scoreCase, summarize, splitAnswer } from '../scripts/eval/score.mjs';
import { BANNED_HEDGES } from '../functions/api/_lib/buildAnalysisPrompt.js';

const CASES = JSON.parse(
  readFileSync(fileURLToPath(new URL('../docs/eval/analysis-cases.json', import.meta.url)), 'utf8'),
);
const byId = (id) => CASES.cases.find((c) => c.id === id);

test('用例文件自检：每条都有 verifiedBy 和 verifiedOn', () => {
  assert.ok(CASES.cases.length >= 5, `用例太少：${CASES.cases.length}`);
  for (const c of CASES.cases) {
    assert.ok(c.verifiedBy, `${c.id} 缺 verifiedBy —— 写不出核实方式的用例不许进来`);
    assert.ok(c.verifiedOn, `${c.id} 缺 verifiedOn`);
    assert.ok(c.files?.length, `${c.id} 缺 files`);
  }
});

test('用例文件自检：覆盖那条最重要的负例', () => {
  const neg = byId('osaka-absent-negative');
  assert.ok(neg, '负例不许被删掉');
  assert.equal(neg.expect.manualReview, true, '负例必须人工判');
  assert.ok(!neg.expect.mustNotMatch, '负例不许用数字正则自动判——会把对的判成错的');
});

test('extractCitations 认得出带印刷页码的引文', () => {
  const got = extractCitations('（文件1·p70 印刷70·合并利润表）行项目"加：其他收益"。');
  assert.deepEqual(got, [{ file: 1, pdf: 70, printed: 70 }]);
});

test('extractCitations 容忍缺印刷页码、多余空格、多条引文', () => {
  const got = extractCitations('（文件1·p86）以及（文件 3 · p14 印刷 10）');
  assert.deepEqual(got, [
    { file: 1, pdf: 86, printed: null },
    { file: 3, pdf: 14, printed: 10 },
  ]);
});

test('数字比对忽略空格与后缀单位', () => {
  const c = byId('beijing-subsidy-2024');
  const answer =
    '政府补助金额：24,851,813,515.25 元（文件1·p70 印刷70）；利润总额 3,168,528,015.74 元。';
  const r = scoreCase(c, answer);
  const nums = r.checks.filter((k) => k.name.startsWith('数字'));
  assert.ok(
    nums.every((k) => k.ok),
    `数字没认出来：${JSON.stringify(nums)}`,
  );
});

test('引用页码单独成项——答对但引错页要能看出来', () => {
  const c = byId('beijing-subsidy-2024');
  // 数字全对，但页码引成 p69
  const answer = '24,851,813,515.25 元、3,168,528,015.74 元（文件1·p69 印刷69）';
  const r = scoreCase(c, answer);
  assert.equal(r.verdict, 'fail');
  const cite = r.checks.find((k) => k.kind === 'citation');
  assert.equal(cite.ok, false, '引错页必须被抓到');
  assert.ok(
    r.checks.filter((k) => k.name.startsWith('数字')).every((k) => k.ok),
    '数字仍应判对——两件事要分开看',
  );
});

test('印刷页码给错了单独报，并说明实际给的是多少', () => {
  const c = byId('tokyo-subsidy-2024');
  // PDF 页对了，印刷页码给成 14（把 PDF 页序抄了过去）
  const answer = 'Operating profit 76,359、Ordinary profit 65,866（文件1·p14 印刷14）';
  const r = scoreCase(c, answer);
  const printed = r.checks.find((k) => k.name.startsWith('印刷页码'));
  assert.equal(printed.ok, false);
  assert.match(printed.note || '', /14/);
});

test('违禁词命中即失败', () => {
  const c = byId('tokyo-subsidy-2024');
  const answer = '76,359 / 65,866（文件1·p14 印刷10），该项**可能是**运营补贴。';
  const r = scoreCase(c, answer);
  assert.equal(r.verdict, 'fail');
});

test('多文件用例：某份文件一次都没被引用就失败（守香港2025静默消失那个回归）', () => {
  const c = byId('subway-six-files');
  // 只引用了文件1~文件5，文件6 一次都没出现 —— 正是上次香港2025静默消失的形态
  const answer = '24,851,813,515.25。北京、东京、香港。见文件1、文件2、文件3、文件4、文件5。';
  const r = scoreCase(c, answer);
  assert.equal(r.verdict, 'fail', '有文件一次都没被引用必须失败');
  const missing = r.checks.filter((k) => k.kind === 'coverage' && !k.ok);
  assert.equal(missing.length, 1);
  assert.match(missing[0].name, /文件6/);
});

// 回归护栏：守打分器自己犯过的错。2026-08-13 第一版按**文件名主干**比对，而模型
// 引用时用的是「文件N」编号，于是六条全判失败——**打分器犯了它要防的那个错**
// （把对的判成错的）。基线判错比没有基线更糟。
test('★ 覆盖检查按文件编号而非文件名——模型用「文件N」引用，不写文件名', () => {
  const c = byId('subway-six-files');
  const answer =
    '24,851,813,515.25。北京、东京、香港。数据来源：文件1、文件2、文件3、文件4、文件5、文件6。';
  const r = scoreCase(c, answer);
  const cov = r.checks.filter((k) => k.kind === 'coverage');
  assert.equal(cov.length, 6);
  assert.ok(
    cov.every((k) => k.ok),
    `全部用编号引用时不该判失败：${JSON.stringify(cov.filter((k) => !k.ok))}`,
  );
});

test('覆盖检查不许把「文件1」误配成「文件11」', () => {
  const c = byId('subway-six-files');
  const r = scoreCase(c, '文件11、文件12、文件13、文件14、文件15、文件16');
  const cov = r.checks.filter((k) => k.kind === 'coverage');
  assert.ok(
    cov.every((k) => !k.ok),
    '两位数编号不该命中一位数的检查',
  );
});

test('splitAnswer 把最终回答与追查过程分开', () => {
  const raw = '结论在这里。\n\n---\n\n### 追跡プロセス / 追查过程\n第 1 轮 …';
  const { answer, trail } = splitAnswer(raw);
  assert.ok(answer.includes('结论在这里'));
  assert.ok(!answer.includes('第 1 轮'), '追查过程不该留在 answer 里');
  assert.ok(trail.includes('第 1 轮'));
});

test('splitAnswer 没有追查过程时整段都是回答', () => {
  const { answer, trail } = splitAnswer('只有结论');
  assert.equal(answer, '只有结论');
  assert.equal(trail, '');
});

// 追查过程是模型的**工作笔记**，"推测模式类似，需补充 p68"是合理的中间状态。
// 混在一起判，会把"过程中谨慎、结论里克制"这种正确行为判成失败。
test('★ 追查过程里的推测只报不判，最终回答里的才算违规', () => {
  const c = byId('hk-profit-2024');
  const raw = [
    '年内利润 16,067 百万港元（文件1·p5 印刷5）。',
    '',
    '### 追跡プロセス / 追查过程',
    '第 2 轮：由于 p69 未显示该行，推测模式类似，需补充 p68。',
  ].join('\n');
  const r = scoreCase(c, raw);
  assert.notEqual(r.verdict, 'fail', '过程里的推测不该判失败');
  assert.deepEqual(r.trailHedges, ['推测'], '但必须报出来');
});

test('最终回答里出现推测性措辞照样失败', () => {
  const c = byId('hk-profit-2024');
  const raw =
    '年内利润 16,067（文件1·p5 印刷5），该项**推测**为补助。\n\n### 追跡プロセス / 追查过程\n无';
  assert.equal(scoreCase(c, raw).verdict, 'fail');
});

// 单一来源：违禁词表从提示词取，不再手抄。2026-08-13 基线首次实跑时，用例里手抄的
// 6 个词漏掉了「通常包含」，而模型那次的最终结论正是「其他收益（通常包含政府补助）」。
test('★ 违禁词表来自提示词，用例没列的也要查（「通常包含」那次漏网）', () => {
  const c = byId('subway-six-files');
  assert.ok(!(c.expect.mustNotContain || []).includes('通常包含'), '用例里刻意不列它');
  assert.ok(BANNED_HEDGES.includes('通常包含'), '提示词里禁了它');
  const answer =
    '对"其他收益"（通常包含政府补助）极度依赖。文件1、文件2、文件3、文件4、文件5、文件6。北京 东京 香港 24,851,813,515.25';
  const r = scoreCase(c, answer);
  assert.equal(r.verdict, 'fail');
  const hit = r.checks.find((k) => k.name.includes('通常包含'));
  assert.ok(hit && !hit.ok, '必须被抓到');
});

test('负例判 manual 而不是 pass —— 不许自动放行', () => {
  const c = byId('osaka-absent-negative');
  const answer = '所提供的文件为东京地铁的年报，其中不包含大阪地铁的数据。';
  const r = scoreCase(c, answer);
  assert.equal(r.verdict, 'manual');
  assert.equal(r.needsHuman, true);
});

test('★ 负例里出现东京的数字不许被判失败——这正是自动判会犯的错', () => {
  const c = byId('osaka-absent-negative');
  // 这是一个**正确**的回答：它引东京的数字来说明文件里只有东京
  const answer =
    '所提供的两份文件均为东京地铁的年报（营业收入 389,267 百万日元），其中不包含大阪地铁的任何数据。';
  const r = scoreCase(c, answer);
  assert.notEqual(r.verdict, 'fail', '正确回答被判失败 —— 基线判错比没有基线更糟');
  assert.equal(r.verdict, 'manual');
});

test('负例仍然跑违禁词检查——人工判不等于什么都不查', () => {
  const c = byId('osaka-absent-negative');
  const answer = '文件里没有大阪地铁的数据，**推测**其营收与东京相近。';
  const r = scoreCase(c, answer);
  assert.equal(r.verdict, 'fail', '违禁词命中时不用等人看');
});

test('空回答直接失败，不许靠"没有违禁词"混过去', () => {
  const r = scoreCase(byId('hk-profit-2024'), '');
  assert.equal(r.verdict, 'fail');
  assert.ok(r.checks.some((k) => k.name === '回答非空' && !k.ok));
});

test('summarize：manual 不计入通过率', () => {
  const s = summarize([
    { verdict: 'pass', checks: [] },
    { verdict: 'fail', checks: [] },
    { verdict: 'manual', checks: [] },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.autoRate, 0.5, '通过率应是 1/(1+1)，manual 不进分母');
  assert.equal(s.manual, 1);
});

test('summarize：引用正确率单独统计', () => {
  const s = summarize([
    {
      verdict: 'pass',
      checks: [{ kind: 'citation', ok: true }, { kind: 'citation', ok: false }, { ok: true }],
    },
  ]);
  assert.equal(s.citationRate, 0.5);
});
