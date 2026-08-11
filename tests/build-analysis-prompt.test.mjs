// 文档分析提示词的规则守护测试。
//
// 这段提示词已改写三次，每次都可能不小心删掉上一次加的硬规则。作者 2026-08-11
// 明确要求两条：① 找到关键信息必须列出来源 ② 确实找不到就说找不到、千万不要猜。
// 这里把它们钉住——不是测"模型会不会遵守"（那要实跑），而是测"这些指令还在不在"。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserMessage,
} from '../functions/api/_lib/buildAnalysisPrompt.js';

const Q = '华为处置子公司荣耀产生的利润，对财务报表有多大影响';

test('两态确实分叉：有提问不强制通用结构，无提问才要概览表', () => {
  const withQ = buildAnalysisSystemPrompt(Q);
  const noQ = buildAnalysisSystemPrompt('');

  assert.ok(withQ.includes('开门见山'), '针对性模式应要求开门见山');
  assert.ok(withQ.includes('不追求大而全'), '针对性模式应明确不追求大而全');
  assert.ok(
    withQ.includes('**不要**输出【关键指标概览】总表'),
    '针对性模式必须明确禁止那张总表——正是它把具体问题挤成了脚注',
  );

  assert.ok(noQ.includes('【关键指标概览】Markdown 表格'), '综合模式应保留概览表');
  assert.ok(!noQ.includes('开门见山'), '综合模式不该带针对性模式的指令');
});

// 作者要求 ①：找到就列来源
test('两态都要求给出来源，且要求覆盖"关键信息"而不只是数字', () => {
  for (const p of [buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt('')]) {
    assert.ok(p.includes('每一条关键信息都要标注来源'), '必须要求关键信息都带来源，不能只限于数字');
    assert.ok(p.includes('（文件N·章节名或表名）'), '必须给出来源格式');
    assert.ok(p.includes('给不出来源的信息不要写'), '必须堵住"说不清哪来的就别写"这个口子');
  }
});

// 作者要求 ②：找不到就说找不到，千万不要猜
test('两态都禁止用推测填补数据缺口，并逐条列出被禁的说法', () => {
  for (const p of [buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt('')]) {
    assert.ok(p.includes('禁止用推测填补数据缺口'), '必须有这条禁令');
    // 泛泛地说"不要猜"没用，得把具体措辞列出来
    for (const phrase of ['可能是', '极有可能', '通常包含', '按惯例']) {
      assert.ok(p.includes(phrase), `应把「${phrase}」这类填空写法明确列为禁止`);
    }
    assert.ok(
      p.includes('是一个完整、合格的回答'),
      '必须明确"找不到"本身就是合格答案，否则模型会凑长度',
    );
  }
});

// 真实违规案例：模型写出了"2020年出售荣耀"，而那个事实不在上传的年报里
test('明确禁止使用外部知识，并保留那个真实反面例子', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('禁止使用你自己知道的任何外部事实'), '必须禁止外部知识');
  assert.ok(p.includes('2020年出售荣耀'), '应保留这个真实反面例子——具体案例比抽象禁令更能约束模型');
});

// 复刻作者的人工分析方法（行项目 → 附注 → 同一行项目跨年对比）。
// 关键点：同一附注编号在不同年度可能解释不同事项——2024 年报的
// 「处置子公司及业务形成的金融工具的公允价值变动」归因于出售荣耀业务，
// 2025 年报同一行归因于出售服务器业务，是两件事。
test('针对性模式教会"追查附注 + 跨年对比"的方法', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('金额在附注里，不在正文'), '必须提示答案通常在附注而非正文');
  assert.ok(p.includes('必须去读对应附注'), '必须要求跟进附注引用');
  assert.ok(
    p.includes('可能解释的是不同事项'),
    '必须警告同一附注编号跨年含义会变——这是本案例的关键',
  );
  assert.ok(p.includes('服务器业务'), '应保留真实对照案例（荣耀 vs 服务器业务）');
  assert.ok(
    p.includes('不等于那一年没有相关影响'),
    '必须堵住"该年附注没提到关键词就答未披露"这个错法',
  );
  assert.ok(p.includes('以行项目名称对齐'), '应说明跨年对齐要按行项目名而非附注编号');
});

test('综合模式不夹带针对性模式的追查方法（避免两态混淆）', () => {
  const noQ = buildAnalysisSystemPrompt('');
  assert.ok(!noQ.includes('金额在附注里，不在正文'), '综合模式不该带这套追查指令');
});

test('保留"文件没有"与"我没看到"的区分', () => {
  for (const p of [buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt('')]) {
    assert.ok(p.includes('绝不要把"我没看到"写成"文件未披露"'), '这条区分必须保留');
  }
});

test('综合模式也受"不许为填满结构而推测"约束', () => {
  const noQ = buildAnalysisSystemPrompt('');
  assert.ok(
    noQ.includes('不要为了填满结构而推测'),
    '综合模式的固定小节最容易诱发推测，必须单独堵一次',
  );
});

// 缓存约束：文档必须在问题之前，否则同一批文档追问时前缀变化、缓存失效，
// 追问成本从约 0.4 元回升到约 1.5 元。
test('user 消息把文档放在问题之前（隐式缓存前缀不变）', () => {
  const msg = buildAnalysisUserMessage('【文件1：年报.pdf】内容内容', Q);
  const iDoc = msg.indexOf('年报.pdf');
  const iQ = msg.indexOf(Q);
  assert.ok(iDoc !== -1 && iQ !== -1, '文档与问题都应出现在消息里');
  assert.ok(iDoc < iQ, '文档必须在问题之前——否则隐式缓存前缀改变，同一批文档追问的成本会翻几倍');
});

test('user 消息在有提问时重申来源与不猜的要求', () => {
  const msg = buildAnalysisUserMessage('文档', Q);
  assert.ok(msg.includes('每条关键信息都要带来源'));
  assert.ok(msg.includes('不要猜'));
});

test('无提问时 user 消息不塞入空的问题块', () => {
  const msg = buildAnalysisUserMessage('文档', '');
  assert.ok(!msg.includes('本次必须回答的问题'), '未提问时不该出现问题块');
});
