// 解析模型的取页指令。多轮取页的第 2 块积木。
//
// 契约（两端都照它实现，改这里就要改 buildAnalysisSystemPrompt）：
//   NEED_PAGES: 文件1:86,87 文件2:84
//   ANSWER: <正文>
//
// 最重要的一条设计：**解析不出来 = 结束**。多轮循环里若"解析失败"不等于"该作答了"，
// 模型一句格式跑偏就会让循环空转到轮数上限，用户白等两分钟还拿不到答案。
// 所以只有"确实解析出至少一页"才继续，其余一律 done。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRequest } from '../js/shared/parse-page-request.js';

const TOTALS = [148, 90]; // 两份文件分别 148 页、90 页

test('单文件：解析出页码，去重并升序', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:87,86,86', 2, TOTALS);
  assert.equal(r.done, false);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86, 87] }]);
});

test('多文件：各自成组', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:86,87 文件2:84', 2, TOTALS);
  assert.equal(r.done, false);
  assert.deepEqual(r.requests, [
    { fileIndex: 1, pages: [86, 87] },
    { fileIndex: 2, pages: [84] },
  ]);
});

test('ANSWER: 开头表示可以作答', () => {
  const r = parsePageRequest('ANSWER: 2023 年为 55,853 百万元（文件1·p86）', 2, TOTALS);
  assert.equal(r.done, true);
  assert.deepEqual(r.requests, []);
});

// 索引给模型的格式是 `p86 (印刷84) | 摘要`，模型很可能把括注一起抄回来。
// 印刷页码和 PDF 页序差 2，抄错就取错页——而两者都是合法页码，事后无从发现。
test('括注里的印刷页码必须被丢掉，只认 PDF 页序', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:86(印刷84)', 2, TOTALS);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86] }], '印刷页码 84 不许被当成请求');

  const full = parsePageRequest('NEED_PAGES: 文件1:86（印刷84）,87（印刷85）', 2, TOTALS);
  assert.deepEqual(full.requests, [{ fileIndex: 1, pages: [86, 87] }], '全角括号同样要丢');
});

test('页码写成 p86 也认（索引里就是这个形态）', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:p86,p87', 2, TOTALS);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86, 87] }]);
});

test('全角冒号、多余空格、包在 markdown 代码块里都要能解析', () => {
  const r = parsePageRequest('```\nNEED_PAGES： 文件1 : 86 , 87\n```', 2, TOTALS);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86, 87] }]);
});

test('指令后面还有正文时，只取指令那一行', () => {
  const text = 'NEED_PAGES: 文件1:86\n我需要先看利润表再判断，附注可能在后面。';
  const r = parsePageRequest(text, 2, TOTALS);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86] }]);
});

test('超出总页数的页码静默丢弃，不作废整条请求', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:86,999', 2, TOTALS);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86] }], '86 应保留，999 丢掉');
});

test('文件号越界的整组丢掉，其余保留', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:86 文件5:12', 2, TOTALS);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86] }]);
});

// 下面这组全部必须 done:true —— 死循环的唯一防线
test('坏格式一律当"没有索要"，进入强制作答', () => {
  const bad = [
    'NEED_PAGES:',
    'NEED_PAGES: ',
    'NEED_PAGES: 文件一:八十六', // 中文数字
    'NEED_PAGES: 文件1:',
    'NEED_PAGES: 文件9:5', // 只有越界文件
    'NEED_PAGES: 文件1:0', // 页码 0 非法（页码 1 起）
    'NEED_PAGES: 文件1:999', // 只有越界页码
    '我想再看看利润表和附注。', // 完全没有指令
    '',
  ];
  for (const t of bad) {
    const r = parsePageRequest(t, 2, TOTALS);
    assert.equal(r.done, true, `应判为 done：${JSON.stringify(t)}`);
    assert.deepEqual(r.requests, [], `requests 应为空：${JSON.stringify(t)}`);
  }
});

test('非法入参不炸', () => {
  assert.deepEqual(parsePageRequest(null, 2, TOTALS), { done: true, requests: [] });
  assert.deepEqual(parsePageRequest('NEED_PAGES: 文件1:86', 0, []), { done: true, requests: [] });
  // totalPages 缺失时不做上界过滤，但仍要能解析
  const r = parsePageRequest('NEED_PAGES: 文件1:86', 2, undefined);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [86] }]);
});

test('总页数上限：模型要一整本时只取前 N 页，别把一轮的预算撑爆', () => {
  const many = 'NEED_PAGES: 文件1:1,2,3,4,5,6,7,8,9,10 文件2:1,2,3';
  const r = parsePageRequest(many, 2, TOTALS, { maxPages: 4 });
  const total = r.requests.reduce((n, q) => n + q.pages.length, 0);
  assert.equal(total, 4, `应截到 4 页，实际 ${total}`);
  assert.equal(r.done, false);
  // 截断要按出现顺序保留，不能把第二份文件整个饿死之外还打乱第一份
  assert.deepEqual(r.requests[0], { fileIndex: 1, pages: [1, 2, 3, 4] });
});

test('多行 NEED_PAGES 合并，不丢文件', () => {
  const r = parsePageRequest('NEED_PAGES: 文件1:86\nNEED_PAGES: 文件2:12', 2, TOTALS);
  assert.deepEqual(r.requests, [
    { fileIndex: 1, pages: [86] },
    { fileIndex: 2, pages: [12] },
  ]);
});
