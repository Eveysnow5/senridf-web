// 锚点检查：查"有判断但没出处"的句子。
//
// 三次实跑证明「禁止使用外部知识」这条 prompt 规则拦不住——每跑换一个说法，行为一次
// 都没变（在会计实务中 → 在中国企业会计准则下 → 属于典型的政策性融资平台）。
// 所以改成确定性检查：不管它怎么措辞，**做判断就必须能指到一个出处**。
//
// ⚠️ 这组测试里"不许误报"的分量比"必须抓到"更重。判断句识别宁可漏判也不误判：
// 漏判只是少抓一个；**误判会惩罚正确行为**（带保留的句子恰恰是我们想要的），
// 而且会让人不再信这个指标 —— 那时它就等于不存在。
//
// 句子全部取自 docs/eval/results/ 下三次真实运行的输出，不是编的。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAnchors, splitSentences } from '../scripts/eval/anchor-check.mjs';

/* ── 切句 ───────────────────────────────────────────────────────────────── */

test('按中文标点与换行切句', () => {
  const s = splitSentences('营收 100 亿。成本 200 亿；因此亏损。\n下一行也是一句');
  assert.equal(s.length, 4);
  assert.ok(s[0].includes('营收 100 亿'));
});

test('小数点不当作句号——财报里全是 24,851,813,515.25 这种数', () => {
  const s = splitSentences('其他收益 24,851,813,515.25 元，净利润 2,765,744,004.12 元。');
  assert.equal(s.length, 1, `不该被小数点切开：${JSON.stringify(s)}`);
});

/* ── 必须抓到：三次实跑里真实出现过的无出处判断 ──────────────────────── */

test('★ 抓到三次实跑里真实的无出处判断（每次换一个说法，都要抓住）', () => {
  const real = [
    '在会计实务中，城投类地铁公司的"其他收益"绝大部分为政府购买服务补贴或运营补贴。',
    '在中国企业会计准则下，"其他收益"科目主要核算与企业日常活动相关的政府补助。',
    '北京地铁属于典型的政策性融资平台，其生存完全依赖于政府通过"其他收益"形式注入的资金。',
    '港铁通常采用"铁路+物业"模式自负盈亏。',
  ];
  for (const s of real) {
    const r = analyzeAnchors(s);
    assert.equal(r.judgments, 1, `没认出这是判断句：${s}`);
    assert.equal(r.anchored, 0, `不该算有出处：${s}`);
  }
});

/* ── 绝不许误报：这些都是**正确行为** ────────────────────────────────── */

test('★ 缺失声明不是判断句——那正是我们想要的行为，判成违规就是在惩罚它', () => {
  const good = [
    '文件未提供财务报表附注中关于"其他收益"的明细表，无法确认248.5亿元中有多少严格定义为"政府补助"。',
    '由于文件中未披露政府补助的具体金额，无法计算其对利润或收入的依赖比率。',
    '在提供的综合损益摘要及分部业绩中，未见名为"政府补助"或"Government Grants"的行项目。',
    '该页未显示"净利润"最终行，也未提供"其他收益"的附注拆分。',
    '所提供的片段中未包含该信息，可能存在于未提供的章节。',
  ];
  for (const s of good) {
    const r = analyzeAnchors(s);
    assert.equal(r.judgments, 0, `缺失声明被误判成判断句：${s}`);
  }
});

test('纯数字转述不是判断句', () => {
  const r = analyzeAnchors(
    '其他收益：25,303,329,581.38 元（约253.03亿元）。营业收入：18,759,711,946.29 元。',
  );
  assert.equal(r.judgments, 0);
});

test('纯算术比较不是判断句', () => {
  const r = analyzeAnchors('"其他收益"金额（248.5亿）是净利润（27.7亿）的约 8.97 倍。');
  assert.equal(r.judgments, 0, '算出来的倍数是转述，不是判断');
});

test('标题与结构行不是判断句', () => {
  const r = analyzeAnchors('1. 北京地铁（北京市基础设施投资有限公司）\n详细数据与来源\n总结回答');
  assert.equal(r.judgments, 0);
});

/* ── 锚点识别 ───────────────────────────────────────────────────────────── */

test('句内锚点：文件+页码、只有文件号、准则库三种都算', () => {
  for (const s of [
    '这表明主营业务无法覆盖成本（文件2·p68 印刷68）。',
    '这表明主营业务无法覆盖成本（文件2）。',
    '"其他收益"科目主要核算政府补助（准则库·企业会计准则第16号）。',
  ]) {
    const r = analyzeAnchors(s);
    assert.equal(r.judgments, 1, `应认出判断句：${s}`);
    assert.equal(r.anchored, 1, `应认出锚点：${s}`);
  }
});

// 三次实跑里最常见的排版：数字一行、来源另起一行。按句严判会把它全判成没出处。
test('★ 紧跟其后的「来源：」行算作上一句的锚点', () => {
  const text = [
    '这表明主营业务无法覆盖成本。',
    '来源：（文件2·p68 印刷68）合并利润表，"二、营业总成本"行。',
  ].join('\n');
  const r = analyzeAnchors(text);
  assert.equal(r.judgments, 1);
  assert.equal(r.anchored, 1, '来源行没有被算给上一句');
});

test('「来源：」行只归给紧邻的上一句，不许往上蔓延', () => {
  const text = [
    '北京地铁属于典型的政策性融资平台。',
    '其他收益：25,303,329,581.38 元。',
    '来源：（文件2·p68 印刷68）',
  ].join('\n');
  const r = analyzeAnchors(text);
  assert.equal(r.judgments, 1, '只有第一句是判断句');
  assert.equal(r.anchored, 0, '来源行归第二句，不该救到第一句头上');
});

/* ── 汇总 ───────────────────────────────────────────────────────────────── */

test('anchorRate：有判断句才有比率，没有则为 null', () => {
  assert.equal(analyzeAnchors('其他收益 100 元。').anchorRate, null);
  const r = analyzeAnchors('这表明依赖极高（文件1·p70）。港铁通常采用铁路加物业模式自负盈亏。');
  assert.equal(r.judgments, 2);
  assert.equal(r.anchored, 1);
  assert.equal(r.anchorRate, 0.5);
});

test('把没锚点的判断句原文列出来——只报一个比率没法定位问题', () => {
  const r = analyzeAnchors('北京地铁属于典型的政策性融资平台。');
  assert.equal(r.unanchored.length, 1);
  assert.match(r.unanchored[0], /政策性融资平台/);
});

test('空输入不炸', () => {
  const r = analyzeAnchors('');
  assert.equal(r.judgments, 0);
  assert.equal(r.anchorRate, null);
});

// ⚠️ 已知盲区，写下来免得后人以为召回是全的。
// 「营业总成本远超营业收入，主营业务本身巨额亏损」是个判断，但它不含任何判断词，
// 检查不出来。这是**刻意的取舍**：判断词表每加一个词，都多一分误判正确句子的风险，
// 而误判会让人不再看这个指标。宁可漏判。
test('已知盲区：不含判断词的判断句抓不到（刻意的取舍，不是 bug）', () => {
  const r = analyzeAnchors('营业总成本远超营业收入，主营业务本身巨额亏损。');
  assert.equal(r.judgments, 0, '如果这条变绿了，说明有人放宽了判断词表——请先确认误报没有增加');
});

// ★ 保留不许洗白断言。两句都来自真实实跑，区别只在有没有转折。
test('★ 「保留 + 但 + 断言」要抓；「保留 + 因此 + 无法计算」不许误伤', () => {
  const laundered =
    '文件未提供附注，无法确认248.5亿元中有多少严格定义为"政府补助"，但基于科目性质和金额量级，依赖程度极高的结论成立。';
  const honest = '文件未披露该数据，因此无法计算依赖程度。';

  assert.equal(analyzeAnchors(laundered).judgments, 1, '转折后的无据断言必须抓到');
  assert.equal(analyzeAnchors(laundered).anchored, 0);
  assert.equal(analyzeAnchors(honest).judgments, 0, '纯粹的"查不到所以算不了"不许误伤');
});

// 下面三条都是首版在真实输出上产生的**误报**，修完必须守住。
test('★ 开场白不是判断句（"…分析如下："只是在宣布要讲什么）', () => {
  const r = analyzeAnchors(
    '基于本轮提供的页面图像，针对三家地铁公司对政府补助的依赖程度分析如下：',
  );
  assert.equal(r.judgments, 0);
});

test('★ 表头不是判断句（列名而已）', () => {
  const r = analyzeAnchors(
    '公司 | 政府补助金额 (文件披露) | 净利润 (文件披露) | 依赖程度判断 | 依据来源',
  );
  assert.equal(r.judgments, 0);
});

test('★ 表格数据行里裸写的「文件2·p68」也算锚点（没有括号）', () => {
  const r = analyzeAnchors(
    '北京地铁 | 253.03 亿元 (其他收益) | ~21.5 亿元 | >1000% (极度依赖) | 文件2·p68',
  );
  assert.equal(r.judgments, 1, '数据行有数字，不该被当表头豁免');
  assert.equal(r.anchored, 1, '裸写的文件2·p68 应算锚点');
});

test('★ 表头含年份也仍是表头——判据是有没有金额，不是有没有数字', () => {
  const header =
    '公司 | 2025财年政府补助/类似项金额 | 2025财年净利润 | 依赖程度 (补助/净利) | 数据来源';
  assert.equal(analyzeAnchors(header).judgments, 0, '含「2025」的表头不该被当判断句');
});

test('★ 表头含年份也仍是表头——判据是有没有金额，不是有没有数字', () => {
  const header =
    '公司 | 2025财年政府补助/类似项金额 | 2025财年净利润 | 依赖程度 (补助/净利) | 数据来源';
  assert.equal(analyzeAnchors(header).judgments, 0, '含「2025」的表头不该被当判断句');
});
