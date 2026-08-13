// 知识库检索与注入渲染。
//
// 这组测试守两件事：① 库本身的质量（每条都要有出处和边界，写不出核实方式的不许进来）；
// ② 选不中就不给——无关条目会把模型往错方向诱导。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectKbEntries, renderKbBlock } from '../js/shared/kb-select.js';
import { KB_ENTRIES } from '../js/shared/kb/accounting-cn.js';

test('库自检：每条都有 source / verifiedBy / verifiedOn / doesNotSay', () => {
  assert.ok(KB_ENTRIES.length > 0, '库不能是空的');
  for (const e of KB_ENTRIES) {
    assert.ok(e.id, '缺 id');
    assert.ok(e.terms?.length, `${e.id} 缺 terms`);
    assert.ok(e.text, `${e.id} 缺 text`);
    assert.ok(e.source, `${e.id} 缺 source`);
    assert.ok(e.verifiedBy, `${e.id} 缺 verifiedBy —— 写不出核实方式的条目不许进来`);
    assert.ok(e.verifiedOn, `${e.id} 缺 verifiedOn`);
    assert.ok(e.doesNotSay, `${e.id} 缺 doesNotSay —— 只给规则不给边界，等于给过度解读发许可证`);
  }
});

test('库自检：verifiedBy 不许是占位符', () => {
  for (const e of KB_ENTRIES) {
    assert.ok(!/待填|TODO|待补|凭记忆|大概/.test(e.verifiedBy), `${e.id} 的 verifiedBy 还是占位符`);
  }
});

test('按提问命中：问政府补助时选出 CAS16 那几条', () => {
  const got = selectKbEntries('这些公司对政府补助的依赖有多大？', KB_ENTRIES);
  assert.ok(got.length > 0, '应该命中');
  assert.ok(
    got.every((e) => e.id.startsWith('cas16')),
    '命中的应该是政府补助相关条目',
  );
});

test('★ 选不中就一条都不给——不许"保底给一条"', () => {
  // 无关条目会把模型往那个方向诱导：问营收增长却塞政府补助的准则，它就会往补助上解释
  const got = selectKbEntries('这两年的营业收入增长率是多少？', KB_ENTRIES);
  assert.deepEqual(got, [], `不该命中任何条目，实际命中 ${got.map((e) => e.id).join(',')}`);
});

test('上限：最多给 3 条', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: 'x' + i,
    terms: ['其他收益'],
    text: 't',
    doesNotSay: 'd',
    source: 's',
  }));
  assert.equal(selectKbEntries('其他收益是多少', many).length, 3);
  assert.equal(selectKbEntries('其他收益是多少', many, { max: 1 }).length, 1);
});

test('命中词多的排前面', () => {
  const entries = [
    { id: 'few', terms: ['其他收益'], text: 't', doesNotSay: 'd', source: 's' },
    {
      id: 'many',
      terms: ['其他收益', '政府补助', '附注'],
      text: 't',
      doesNotSay: 'd',
      source: 's',
    },
  ];
  const got = selectKbEntries('其他收益里的政府补助在附注里吗', entries);
  assert.equal(got[0].id, 'many');
});

test('空提问 / 空库 / 畸形入参不炸', () => {
  assert.deepEqual(selectKbEntries('', KB_ENTRIES), []);
  assert.deepEqual(selectKbEntries('政府补助', []), []);
  assert.deepEqual(selectKbEntries('政府补助', null), []);
  assert.deepEqual(selectKbEntries(null, KB_ENTRIES), []);
});

/* ── 注入文本 ───────────────────────────────────────────────────────────── */

test('★ 渲染时 doesNotSay 必须跟着一起给', () => {
  const block = renderKbBlock(selectKbEntries('政府补助占比', KB_ENTRIES));
  assert.ok(block.includes('没有**说'), '缺少边界提示');
  for (const e of selectKbEntries('政府补助占比', KB_ENTRIES)) {
    assert.ok(block.includes(e.doesNotSay), `${e.id} 的 doesNotSay 没被渲染进去`);
  }
});

test('渲染时说清：准则库是合法出处，但不提供任何数字', () => {
  const block = renderKbBlock(KB_ENTRIES.slice(0, 1));
  assert.ok(block.includes('合法的出处'), '要说明它可以被引用');
  assert.ok(block.includes('不提供任何公司的任何数字'), '要说明它不给数字');
  assert.ok(block.includes('准则库·'), '要给出引用格式');
});

test('★ 渲染出来的引用格式，锚点检查认得出来', async () => {
  const { analyzeAnchors } = await import('../scripts/eval/anchor-check.mjs');
  const e = KB_ENTRIES[0];
  const sentence = `"其他收益"科目主要核算政府补助（准则库·${e.source}）。`;
  const r = analyzeAnchors(sentence);
  assert.equal(r.judgments, 1);
  assert.equal(r.anchored, 1, '按知识库格式引用后，锚点检查必须认它——否则两边契约脱节');
});

test('没有条目时渲染成空串，不塞一个空壳标题', () => {
  assert.equal(renderKbBlock([]), '');
  assert.equal(renderKbBlock(null), '');
});
