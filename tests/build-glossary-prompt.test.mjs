import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGlossaryPrompt } from '../functions/api/_lib/buildGlossaryPrompt.js';

test('空术语表 + 空 context 返回空串（不改变原 prompt）', () => {
  assert.equal(buildGlossaryPrompt([], ''), '');
  assert.equal(buildGlossaryPrompt(undefined, undefined), '');
});

test('有术语时输出含各术语的中/日/英', () => {
  const out = buildGlossaryPrompt(
    [{ zh: '南雪', ja: 'ナンシュエ', en: 'Nanxue', note: '创始人' }],
    '',
  );
  assert.match(out, /南雪/);
  assert.match(out, /ナンシュエ/);
  assert.match(out, /Nanxue/);
  assert.match(out, /创始人/);
});

test('过滤掉缺 zh 或 ja 的条目', () => {
  const out = buildGlossaryPrompt(
    [
      { zh: '有效', ja: 'ゆうこう' },
      { zh: '', ja: 'なし' },
      { zh: '缺日文', ja: '' },
      { ja: '没有中文' },
    ],
    '',
  );
  assert.match(out, /有效/);
  assert.doesNotMatch(out, /なし/);
  assert.doesNotMatch(out, /缺日文/);
});

test('只有 context 没术语时输出含 context 段', () => {
  const out = buildGlossaryPrompt([], '本次会议讨论硬件采购');
  assert.match(out, /本次会议讨论硬件采购/);
});

test('非数组 glossary 不抛错、返回空串', () => {
  assert.equal(buildGlossaryPrompt('not-an-array', ''), '');
  assert.equal(buildGlossaryPrompt(null, ''), '');
});

test('en/note 缺省时不报错', () => {
  const out = buildGlossaryPrompt([{ zh: '案件', ja: '案件' }], '');
  assert.match(out, /案件/);
});
