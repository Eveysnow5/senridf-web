// 查找指令的解析与执行。
//
// 起因是 2026-08-13 的真实失败：模型读了东京页面索引的前 5 行（翻译声明 / cash flows /
// 目录）就断定"未见损益表"、主动放弃索要——而索引第 9 行明写着
// `p14 | (2) Consolidated Statements of Income and Comprehensive Income`。
// 索引是"每页开头 80 字"，开头几页天然是封面/目录，**最不能代表全文**。
// FIND 把"要不要看完"从模型的自觉变成机械保证。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindRequest } from '../js/shared/parse-find-request.js';
import { searchPages, renderFindResults } from '../js/shared/search-pages.js';

/* ── 解析 ───────────────────────────────────────────────────────────────── */

test('带文件号：分组解析，逗号分词', () => {
  const r = parseFindRequest('FIND: 文件1:其他收益,政府补助', 3);
  assert.deepEqual(r.finds, [{ fileIndex: 1, terms: ['其他收益', '政府补助'] }]);
});

test('多个文件号写在同一行', () => {
  const r = parseFindRequest('FIND: 文件1:其他收益 文件3:Statements of Income', 3);
  assert.deepEqual(r.finds, [
    { fileIndex: 1, terms: ['其他收益'] },
    { fileIndex: 3, terms: ['Statements of Income'] },
  ]);
});

test('不写文件号 = 所有文件都找', () => {
  const r = parseFindRequest('FIND: 政府补助,Government grants', 6);
  assert.deepEqual(r.finds, [{ fileIndex: null, terms: ['政府补助', 'Government grants'] }]);
});

// 与 parse-page-request 同源的两条设计
test('括号里的说明不许被当成查找词', () => {
  const r = parseFindRequest('FIND: 文件1:其他收益（政府补助的主要载体）', 2);
  assert.deepEqual(r.finds, [{ fileIndex: 1, terms: ['其他收益'] }]);
});

test('★ 解析不出来 = 没有查找请求（不许让循环因格式跑偏而空转）', () => {
  for (const bad of ['FIND:', 'FIND: ', 'FIND: 文件9:x', '我想找一下政府补助', '']) {
    assert.deepEqual(parseFindRequest(bad, 2).finds, [], `应为空：${JSON.stringify(bad)}`);
  }
});

test('单字词丢掉（没有检索价值），文件号越界丢掉', () => {
  assert.deepEqual(parseFindRequest('FIND: 文件1:的,其他收益', 2).finds, [
    { fileIndex: 1, terms: ['其他收益'] },
  ]);
  assert.deepEqual(parseFindRequest('FIND: 文件7:其他收益', 3).finds, []);
});

test('词数上限：一轮最多 6 个词', () => {
  const r = parseFindRequest('FIND: a1,b2,c3,d4,e5,f6,g7,h8', 1);
  const total = r.finds.reduce((n, f) => n + f.terms.length, 0);
  assert.equal(total, 6);
});

test('markdown 围栏、全角冒号都要能解析', () => {
  const r = parseFindRequest('```\nFIND： 文件2:补助金\n```', 3);
  assert.deepEqual(r.finds, [{ fileIndex: 2, terms: ['补助金'] }]);
});

test('非法入参不炸', () => {
  assert.deepEqual(parseFindRequest(null, 3).finds, []);
  assert.deepEqual(parseFindRequest('FIND: 文件1:x', 0).finds, []);
});

/* ── 执行 ───────────────────────────────────────────────────────────────── */

const PAGES = [
  'Note: This document has been translated from the Japanese original',
  '(3) Consolidated cash flows Cash flows from operating activities',
  '1 Table of Contents - Attachments 1. Overview of Operating Results',
  '(2) Consolidated Statements of Income and Comprehensive Income Operating revenue 389,267',
  'Consolidated Statements of Comprehensive Income (Millions of yen)',
];

// ★ 这就是那次失败的场景：模型看索引前几行以为没有损益表，一搜就在 p4。
test('★ 搜得到索引开头看不出来的页（东京那次失败的场景）', () => {
  const [r] = searchPages(PAGES, ['Statements of Income']);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].page, 4, '损益表在第 4 页');
});

test('英文不区分大小写', () => {
  const [r] = searchPages(PAGES, ['statements of income']);
  assert.equal(r.hits[0].page, 4);
});

test('汉字之间被插的空格不许让匹配静默失效', () => {
  const [r] = searchPages(['加：其 他 收 益 24,851,813,515.25'], ['其他收益']);
  assert.equal(r.hits.length, 1, 'PDF 抽取常在汉字间插空格，不归一化就永远搜不到');
});

test('报出命中次数与上下文，供判断是不是要找的那个', () => {
  const [r] = searchPages(['其他收益 100 其他收益 200'], ['其他收益']);
  assert.equal(r.hits[0].count, 2);
  assert.ok(r.hits[0].snippet.includes('其他收益'));
});

test('命中页数上限，避免回执撑大', () => {
  const many = Array.from({ length: 30 }, () => '其他收益');
  const [r] = searchPages(many, ['其他收益']);
  assert.equal(r.hits.length, 8);
});

/* ── 回执 ───────────────────────────────────────────────────────────────── */

// ⚠️ "没有回执"和"回执说没命中"对模型是两回事：前者它会以为搜索没跑，
// 后者才是可以据以判断"文件里确实没有"的证据（核心规则第九条）。
test('★ 一个都没命中时必须明说"全文未命中"，不能省略', () => {
  const out = renderFindResults(searchPages(PAGES, ['政府补助']), '文件3：东京2024');
  assert.ok(out.includes('全文未命中'), `应明说未命中：${out}`);
  assert.ok(out.includes('政府补助'), '要说清是哪个词没命中');
});

test('命中时给出页码、次数和一段例子', () => {
  const out = renderFindResults(searchPages(PAGES, ['Statements of Income']), '文件3');
  assert.ok(out.includes('p4'), '要给页码');
  assert.ok(/例 p4/.test(out), '要给一段上下文');
});

test('空结果渲染成空串', () => {
  assert.equal(renderFindResults([], '文件1'), '');
  assert.equal(renderFindResults(null, '文件1'), '');
});
