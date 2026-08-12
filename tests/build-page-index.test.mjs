// 页面索引：给模型一份"每页大概讲什么"的清单，它才能说"给我第 86 页"。
// 多轮取页（docs/plans/2026-08-12-analysis-multiround-plan.md）的第 1 块积木。
//
// 为什么带印刷页码：2026-08-12 首次跑通图像路径后，模型的引文是「第86页」——那是我们
// 给它的 **PDF 页序**（pdf.getPage(n) 的 n），而年报那一页自己印的页码是 **84**。
// 作者拿 86 去年报里对，翻到的不是那张表。「每条引文带页码」这条纪律的全部意义就是
// 让人能核，页码系统对不上，纪律就打了折。
// 但印刷页码是**认出来的**，不是给定的，所以宁可没有也不能给错的——认不准就整份退回
// 只给 PDF 页序。判据是连号率：页眉页码天然连续，不连续说明认错了。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPageIndex, detectPrintedPages } from '../js/shared/build-page-index.js';

/** 真实夹具：华为 2024 年报的 40 页文字层（印刷页码 54–93，两种页眉形态）。 */
const REAL_PAGES = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/huawei-2024-pages.json', import.meta.url)),
    'utf8',
  ),
);

test('夹具自检：真实 40 页，且含目标表格页', () => {
  assert.equal(REAL_PAGES.length, 40);
  const hit = REAL_PAGES.findIndex((t) => String(t).includes('55,853'));
  assert.ok(hit >= 0, '夹具应含 55,853 那一页');
  assert.ok(String(REAL_PAGES[hit]).startsWith('84 '), '那一页的页眉印刷页码应是 84');
});

test('每页恰好一行，页码从 1 起且与下标对齐', () => {
  const lines = buildPageIndex(REAL_PAGES).split('\n');
  assert.equal(lines.length, REAL_PAGES.length, '行数必须等于页数');
  assert.ok(lines[0].startsWith('p1 '), `第一行应是 p1，实际：${lines[0]}`);
  assert.ok(lines[39].startsWith('p40 '), `最后一行应是 p40，实际：${lines[39]}`);
});

test('识别得出的印刷页码作括注挂在 PDF 页序后面', () => {
  const lines = buildPageIndex(REAL_PAGES).split('\n');
  // 含 55,853 的是数组下标 30 → PDF 第 31 页，印刷页码 84
  const line = lines[30];
  assert.ok(line.startsWith('p31 '), `应是 p31，实际：${line}`);
  assert.ok(line.includes('印刷84'), `应带印刷页码 84，实际：${line}`);
  assert.ok(line.includes('其他净收支'), `摘要应含表名，实际：${line}`);
});

test('印刷页码认不准时整份退回只给 PDF 页序——宁可没有也不能给错的', () => {
  // 页眉数字乱序 = 认错了（真实页眉必然连号）
  const scrambled = [
    '7 华为投资控股有限公司 甲',
    '3 华为投资控股有限公司 乙',
    '91 华为投资控股有限公司 丙',
  ];
  const out = buildPageIndex(scrambled);
  assert.ok(!out.includes('印刷'), `不连号就不该给印刷页码，实际：\n${out}`);
  assert.ok(out.split('\n')[0].startsWith('p1 '), 'PDF 页序仍要给');
});

test('detectPrintedPages：真实夹具 40/40 识别、连号，偏移恒定', () => {
  const r = detectPrintedPages(REAL_PAGES);
  assert.equal(r.trustworthy, true);
  assert.equal(r.numbers.length, 40);
  assert.ok(
    r.numbers.every((v) => v !== null),
    '真实夹具应每页都识别得出',
  );
  // 印刷页码 - PDF 页序 应是常数
  const offsets = new Set(r.numbers.map((v, i) => v - (i + 1)));
  assert.equal(offsets.size, 1, `偏移应恒定，实际有 ${offsets.size} 种：${[...offsets]}`);
});

test('汉字之间的空格要归一化，否则摘要里全是「华 为 技 术」', () => {
  const out = buildPageIndex(['已 转 移 至 客 户 的 商 品']);
  assert.ok(out.includes('已转移至客户的商品'), `未归一化：${out}`);
});

test('空页（扫描版无文字层）仍占一行，不许整行消失', () => {
  const out = buildPageIndex(['第一页有字', '   ', '第三页有字']);
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('无文字层'), `空页应标注，实际：${lines[1]}`);
});

test('超预算时截短摘要，但一页都不能少——少一页模型就永远不会索要它', () => {
  const pages = Array.from({ length: 148 }, (_, i) => `第 ${i + 1} 页 ${'内容'.repeat(200)}`);
  const budget = 4000;
  const out = buildPageIndex(pages, { budget });
  assert.equal(out.split('\n').length, 148, '行数必须仍等于页数');
  assert.ok(out.length <= budget, `超预算：${out.length} > ${budget}`);
});

test('默认预算下 148 页的索引仍在十几 KB 量级（这是"索引很便宜"的依据）', () => {
  const pages = Array.from(
    { length: 148 },
    (_, i) => `第 ${i + 1} 页 ${'经营讨论与分析内容'.repeat(50)}`,
  );
  const out = buildPageIndex(pages);
  assert.ok(out.length <= 16000, `默认预算应 ≤16000，实际 ${out.length}`);
  assert.ok(out.length > 8000, `不该缩得太狠，实际 ${out.length}`);
});

test('空输入不炸', () => {
  assert.equal(buildPageIndex([]), '');
  assert.equal(buildPageIndex(null), '');
});
