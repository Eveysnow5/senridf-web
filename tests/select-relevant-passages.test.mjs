// 按提问挑片段的纯函数测试。
//
// 夹具刻意复现真实年报的形状，而不是"短一号、干净一号"的合成数据：
//   · 总长超过预算，逼函数真的走筛选分支（不然测的是"整篇装得下"那条）
//   · 高频词「华为」几乎每块都有 —— 这是陷阱，按命中次数排序会让它霸榜
//   · 目标词「荣耀」只出现在一个块里，且**位置很深**（远超 headChars）
// 这三条正是 2026-08-11 真实翻车的形状：187,405 字的年报截前 30,000 字，
// 附注里的荣耀处置数据整段丢失，模型于是回答"文件未披露"。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  selectRelevantPassages,
  extractTerms,
  normalizeCjkSpacing,
} from '../js/shared/select-relevant-passages.js';

const FILLER =
  '华为坚持以客户为中心，持续投入研发，推动产业健康发展。本节讨论经营环境与业务进展，' +
  '涵盖运营商业务、企业业务与消费者业务的整体表现，以及区域市场的经营情况。';

/** 造一份"像年报"的长文：大量含高频词的填充块，目标块埋在很深的位置。 */
function buildReport({ blocks = 400, targetAt = 250 } = {}) {
  const out = [];
  for (let i = 0; i < blocks; i++) {
    if (i === targetAt) {
      out.push(
        '合并财务报表附注 十三、处置子公司\n' +
          '本集团于报告期内确认处置荣耀终端有限公司相关递延收益人民币 4,213 百万元，' +
          '计入其他业务收入。该处置对当期净利润的影响为增加人民币 3,180 百万元。',
      );
    } else {
      out.push(`第 ${i + 1} 节 经营讨论\n${FILLER}${FILLER}`);
    }
  }
  return out.join('\n\n');
}

const QUESTION = '华为处置子公司荣耀产生的利润，对财务报表有多大影响';

test('extractTerms 能抽出关键检索词，并滤掉纯虚词', () => {
  const terms = extractTerms(QUESTION);
  assert.ok(
    terms.some((t) => t.includes('荣耀')),
    `应抽到「荣耀」相关词，实际：${terms.slice(0, 15).join('/')}`,
  );
  assert.ok(
    terms.some((t) => t.includes('处置')),
    '应抽到「处置」',
  );
  // 这些单独出现时不该成为检索词
  for (const junk of ['的', '对', '多大']) {
    assert.ok(!terms.includes(junk), `不该把「${junk}」当检索词`);
  }
});

// 回归：曾经加过"含单字虚词的 n-gram 一律剔掉"的过滤，把**公司名「华为」**
// （含「为」）连根杀掉，检索词只剩「荣耀」。这类词在财报里到处都是：
// 会计政策(会)、数字能源(能)、有限公司(有)、在建工程(在)、对外投资(对)。
test('含常见虚词字的正当词汇不被误杀（华为 / 会计政策 / 数字能源）', () => {
  for (const [q, must] of [
    ['华为的营收', '华为'],
    ['会计政策变更', '会计政策'],
    ['数字能源业务', '数字能源'],
    ['有限公司股权', '有限公司'],
  ]) {
    const terms = extractTerms(q);
    assert.ok(terms.includes(must), `「${must}」被误杀了，实际抽到：${terms.join('/')}`);
  }
});

test('extractTerms 对空提问返回空数组', () => {
  assert.deepEqual(extractTerms(''), []);
  assert.deepEqual(extractTerms('   '), []);
  assert.deepEqual(extractTerms(undefined), []);
});

test('短文档整篇返回，不做筛选', () => {
  const r = selectRelevantPassages('很短的内容', QUESTION, { budget: 1000 });
  assert.equal(r.mode, 'head');
  assert.equal(r.text, '很短的内容');
});

test('无提问时退回取开头（综合分析模式）', () => {
  const doc = buildReport();
  const r = selectRelevantPassages(doc, '', { budget: 5000 });
  assert.equal(r.mode, 'head');
  // 送出的文本是归一化后的（汉字间空格已去掉），比对时用同一口径
  assert.equal(r.text, normalizeCjkSpacing(doc).slice(0, 5000));
  assert.deepEqual(r.hitTerms, []);
});

// 这是本函数存在的唯一理由：目标段落深埋在文档后段，硬截开头必然丢掉它。
test('目标段落深埋时仍被选中，而硬截开头会丢掉它', () => {
  const doc = buildReport({ blocks: 400, targetAt: 250 });
  const budget = 20000;

  // 先证明夹具确实复现了翻车形状：硬截开头拿不到目标内容
  assert.ok(!doc.slice(0, budget).includes('荣耀'), '夹具失真：硬截开头竟然也包含目标段落');
  assert.ok(doc.length > budget * 3, '夹具失真：文档不够长，筛选分支可能没被触发');

  const r = selectRelevantPassages(doc, QUESTION, { budget });
  assert.equal(r.mode, 'selected');
  assert.ok(r.text.includes('荣耀'), '选出的内容里必须包含目标段落');
  assert.ok(r.text.includes('4,213'), '必须带上具体金额，否则等于没答');
  assert.ok(r.usedChars <= budget, `超预算：${r.usedChars} > ${budget}`);
});

test('预算紧张时目标段落仍能排进来', () => {
  const doc = buildReport({ blocks: 400, targetAt: 250 });
  const r = selectRelevantPassages(doc, QUESTION, { budget: 6000, headChars: 1000 });
  assert.ok(r.text.includes('荣耀'), '预算紧张时目标段落被挤掉了');
});

// IDF 专项。上面那条测不出 IDF：目标块同时命中「荣耀+处置+子公司+利润」四个词、
// 填充块只命中「华为」一个，所以不加权也是 4 > 1，目标照样赢——**去掉 IDF 后
// 那条测试依然全过，等于空转**（2026-08-11 跑突变验证时抓到）。
//
// 这个夹具专门把 IDF 隔离出来：填充块把高频词重复 12 次、目标块只含一个稀有词。
//   不加权：填充块 1+ln(12)≈3.5  >  目标块 1+ln(1)=1        → 目标被挤掉
//   加 IDF：填充块 ln(1+N/N)≈0.69×3.5  <  目标块 ln(1+N)×1  → 目标胜出
test('高频词不会淹没稀有词（IDF 加权本身生效）', () => {
  const noisy = '华为'.repeat(12) + '经营讨论与业务进展说明，涵盖各区域市场表现。';
  const target = '本集团确认处置荣耀相关递延收益人民币 4,213 百万元。';
  const blocks = [];
  for (let i = 0; i < 200; i++) blocks.push(i === 150 ? target : `第${i}节 ${noisy}`);
  const doc = blocks.join('\n\n');

  // 只问高频词 + 稀有词，让两者直接竞争
  const r = selectRelevantPassages(doc, '华为荣耀', {
    budget: 2000,
    headChars: 200,
    minBlockLen: 10,
  });

  assert.ok(
    r.text.includes('4,213'),
    '稀有词段落被高频词段落挤掉了——IDF 加权没生效。' + `实际选中内容开头：${r.text.slice(0, 120)}`,
  );
});

// 真实翻车形状：PDF 两端对齐会让抽取结果变成「公 允 价 值 变 动」，
// 关键词匹配于是静默失效。实测华为 2024 年报有 4,297 处这种空格，
// 归一化后「公允价值变动」的命中从 14 次涨到 18 次。
test('汉字间被插入空格时仍能匹配（PDF 字距归一化）', () => {
  const spaced = '本集团处置子公司及业务形成的金融工具的公 允 价 值 变 动主要为出售荣 耀业务。';
  const doc = '经营讨论与业务进展。\n\n'.repeat(3000) + spaced;
  const r = selectRelevantPassages(doc, '公允价值变动', { budget: 20000 });
  assert.ok(
    r.text.includes('公允价值变动'),
    '被空格拆开的关键词没匹配上——归一化没生效。这类失效是静默的，最危险',
  );
});

test('不动汉字与数字/字母之间的空格（那些分隔有意义）', () => {
  const doc = '交易对价合计人民币 2,500 百万元。\n\n' + '填充内容。\n\n'.repeat(3000);
  const r = selectRelevantPassages(doc, '交易对价', { budget: 20000 });
  assert.ok(r.text.includes('2,500 百万元'), '数字与单位之间的空格不该被吃掉');
});

// 真实 PDF 抽取（pdftotext / pdf.js）常常整篇没有一个空行，每行只用单个换行分隔。
// 原 splitBlocks 只按空行切，实测华为 2024 年报被切成 **1 块**（17 万字），再硬切成
// 18 个 1 万字粗块——粗块里"荣耀出现 1 次"竞争不过"常见词出现几十次"的块。
//
// 这里断言的是**切分机制**（块数），不是端到端结果。原因：端到端能否命中取决于文档
// 词汇的竞争密度，真实年报抽出 61 个检索词、大量块有部分命中才会失败；合成夹具做不到
// 那种密度——试了三个版本，粗块下目标依然被选中，测试等于空转。所以改测"块够不够细"，
// 那才是 bug 本身。端到端由真实 PDF 人工验证（见 docs/TOOLS.md）。
test('整篇没有空行时仍切成细粒度块（真实 PDF 抽取形状）', () => {
  const lines = [];
  for (let i = 0; i < 3000; i++) {
    lines.push(`本集团各业务分部的经营情况如下，收入均计入合并报表第${i}节。`);
  }
  const doc = lines.join('\n'); // 单换行，全文一个空行都没有
  assert.ok(!doc.includes('\n\n'), '夹具失真：必须完全没有空行才复现真实形状');
  assert.ok(doc.length > 80000, '夹具失真：文档要足够长');

  const r = selectRelevantPassages(doc, '业务分部收入', { budget: 20000 });
  assert.ok(
    r.blockCount >= 100,
    `整篇无空行时只切出 ${r.blockCount} 块——退化成粗块了。` +
      '细块是稀有词段落能在打分里胜出的前提',
  );
  const avg = doc.length / r.blockCount;
  assert.ok(avg <= 2000, `平均块大小 ${Math.round(avg)} 字，太粗`);
});

test('保留开头的身份信息（主体、期间、货币单位）', () => {
  const doc = '华为投资控股有限公司 2025 年度报告 货币单位：人民币百万元\n\n' + buildReport();
  const r = selectRelevantPassages(doc, QUESTION, { budget: 20000, headChars: 2000 });
  assert.ok(r.text.includes('2025 年度报告'), '开头的期间信息必须保留，否则后面的数字无法解读');
  assert.ok(r.text.includes('货币单位'), '货币单位必须保留');
});

test('选出的片段保持原文顺序', () => {
  const doc = [
    '第一块 关于荣耀处置的早期说明',
    '中间填充 ' + FILLER + FILLER + FILLER,
    '第三块 荣耀处置的最终确认金额 4,213 百万元',
  ].join('\n\n');
  const r = selectRelevantPassages(doc, QUESTION, { budget: 400, headChars: 50 });
  const iEarly = r.text.indexOf('早期说明');
  const iLate = r.text.indexOf('最终确认');
  if (iEarly !== -1 && iLate !== -1) {
    assert.ok(iEarly < iLate, '顺序被打乱了——财务文档的先后关系是语义的一部分');
  }
});

// highlights 的目标是覆盖稀有词，不是取高分块（见实现里的注释）。
//
// ⚠️ 这条测试**不能**守住"稀有词覆盖"这个逻辑，我试过六个版本都做不到。
// 原因：该失败模式依赖真实全文的竞争密度——146 页、61 个检索词、173 个块时，
// 含「荣耀」（df=1）的块因为不含其它提问词而排不进 top6；但在 32 页节选里块少、
// 竞争弱，纯按分数取也能命中，去掉覆盖逻辑测试照样过（每次都是跑突变验证才发现
// 在空转）。要复现必须把整份 189K 字抽取塞进仓库，那既臃肿也不适合再分发。
//
// 所以：**覆盖逻辑的正确性由真实文档人工验证**（步骤与实测数字见 docs/TOOLS.md）。
// 这条测试只守三件较弱但真实的事：highlights 非空、结构字段齐全、在真实节选上
// 能命中目标句。夹具是 pdf.js 对华为 2024 年报的真实抽取（与线上同一条抽取路径）。
test('highlights 在真实年报节选上非空且命中目标句', () => {
  const doc = readFileSync(
    new URL('./fixtures/huawei-2024-notes-excerpt.txt', import.meta.url),
    'utf8',
  );
  assert.ok(doc.length > 30000, `夹具失真：仅 ${doc.length} 字，会短路到整篇返回`);
  assert.ok(doc.includes('出售荣耀业务'), '夹具失真：节选里没有目标句');

  const Q = '请问从华为的年报看，处置荣耀手机业务的影响，在2024年和2025年分别是多少';
  const r = selectRelevantPassages(doc, Q, { budget: 20000 });

  assert.ok(r.highlights.length > 0, 'highlights 不该为空');
  assert.ok(r.distinctiveTerms.length > 0, '应有稀有词参与覆盖');
  assert.ok(r.highlights.join('\n').includes('出售荣耀业务'), 'highlights 里应包含目标句');
});

test('返回值带上可观测信息（用了多少字、命中哪些词）', () => {
  const doc = buildReport();
  const r = selectRelevantPassages(doc, QUESTION, { budget: 20000 });
  assert.equal(r.totalChars, doc.length);
  assert.ok(r.usedChars > 0 && r.usedChars <= 20000);
  assert.ok(r.hitTerms.length > 0, '应报告命中了哪些检索词，便于排查"为什么没选中"');
});

test('明确告知模型这是筛选后的片段而非全文', () => {
  const r = selectRelevantPassages(buildReport(), QUESTION, { budget: 20000 });
  assert.ok(
    r.text.includes('非全文'),
    '必须声明是片段——否则模型会把"没看到"当成"文件未披露"，这正是原来的 bug',
  );
});
