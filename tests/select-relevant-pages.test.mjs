// 按提问选 PDF 页码的纯函数测试。
//
// 夹具是**真实数据**：pdf.js/pdfium 对华为 2024 年报的按页文本抽取，取「其他净收支」
// 附注页及其前后共 40 页。用真实数据是因为这个功能的成败取决于真实年报的词汇竞争
// 密度——合成夹具在同一批功能上已经空转过六次（详见 select-relevant-passages 测试
// 里的说明），每次都是跑突变验证才发现。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectRelevantPages } from '../js/shared/select-relevant-pages.js';

const pages = JSON.parse(
  readFileSync(new URL('./fixtures/huawei-2024-pages.json', import.meta.url), 'utf8'),
);
const Q = '请问从华为的年报看，处置荣耀手机业务的影响，在2024年和2025年分别是多少';

/** 夹具完整性：目标必须存在且只在一页，否则测的不是"稀有词覆盖"。 */
test('夹具本身可信：目标词只出现在一页', () => {
  const hit = pages.filter((p) => p.includes('荣耀'));
  assert.equal(hit.length, 1, `「荣耀」应只出现在 1 页，实际 ${hit.length} 页`);
  assert.ok(pages.length >= 30, `页数 ${pages.length} 太少，竞争不足`);
});

// ⚠️ 这条测试**守不住"稀有词覆盖"逻辑本身**：40 页夹具里 8 个页位太宽松，
// 目标页纯按分数也排得上，去掉覆盖逻辑测试照样过（已跑突变验证确认）。
// 该失败模式需要完整 148 页的竞争密度——实测那时目标页纯按分数只排第 11/148。
// 覆盖逻辑的正确性由真实全文人工验证，数字记在 docs/TOOLS.md。
// 这条只守较弱但真实的一件事：在真实节选上目标页确实被选中、且不超页数上限。
test('含稀有词的那一页被选中（真实年报节选）', () => {
  const target = pages.findIndex((p) => p.includes('荣耀')) + 1;
  const r = selectRelevantPages(pages, Q, { maxPages: 8 });
  assert.ok(r.pages.includes(target), `第 ${target} 页（「荣耀」所在）没被选中：${r.pages}`);
  assert.ok(r.pages.length <= 8, `选了 ${r.pages.length} 页，超过上限`);
});

test('页码升序且在合法范围内', () => {
  const r = selectRelevantPages(pages, Q, { maxPages: 8 });
  assert.deepEqual(
    r.pages,
    [...r.pages].sort((a, b) => a - b),
    '页码应升序',
  );
  for (const n of r.pages) {
    assert.ok(n >= 1 && n <= pages.length, `页码 ${n} 越界`);
  }
});

// 无提问时不该走图像路径——那是综合分析，按财务关键词挑章节的文本路径更合适
test('无提问时返回空，交给文本路径', () => {
  assert.deepEqual(selectRelevantPages(pages, '').pages, []);
  assert.deepEqual(selectRelevantPages(pages, '   ').pages, []);
});

test('空输入不炸', () => {
  assert.deepEqual(selectRelevantPages([], Q).pages, []);
  assert.deepEqual(selectRelevantPages(undefined, Q).pages, []);
});

// 汉字间空格归一化必须同样作用在选页上，否则 PDF 字距会让关键词匹配静默失效
test('页面文本里汉字被空格拆开时仍能匹配', () => {
  // 每个字之间都插空格：否则像「出售荣」这种未被拆开的 n-gram 仍能匹配，
  // 突变掉归一化后测试照样过（第一版就是这样空转的）。
  const docs = [
    '无关内容'.repeat(50),
    '出 售 荣 耀 业 务 形 成 的 金 融 工 具',
    '别的内容'.repeat(50),
  ];
  const r = selectRelevantPages(docs, '出售荣耀业务', { maxPages: 2 });
  assert.ok(r.pages.includes(2), `被空格拆开的关键词没匹配上：${r.pages}`);
});

test('报告参与覆盖的稀有词，便于排查"为什么选了这些页"', () => {
  const r = selectRelevantPages(pages, Q, { maxPages: 8 });
  assert.ok(r.distinctiveTerms.length > 0);
  assert.ok(r.distinctiveTerms.includes('荣耀'), `稀有词里应有「荣耀」：${r.distinctiveTerms}`);
});
