import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  locateSnippet,
  mergeSpans,
  buildAnnotatedSegments,
} from '../js/shared/proofread-highlight.js';

test('locateSnippet 命中返回 index/length', () => {
  assert.deepEqual(locateSnippet('abcdef', 'cd'), { index: 2, length: 2 });
});

test('locateSnippet 未命中返回 null', () => {
  assert.equal(locateSnippet('abcdef', 'xy'), null);
});

test('locateSnippet 空文本或空片段返回 null', () => {
  assert.equal(locateSnippet('', 'a'), null);
  assert.equal(locateSnippet('abc', ''), null);
  assert.equal(locateSnippet('abc', null), null);
});

test('mergeSpans 合并重叠、排序乱序输入', () => {
  const merged = mergeSpans([
    { index: 5, length: 3 },
    { index: 0, length: 3 },
    { index: 2, length: 2 },
  ]);
  assert.deepEqual(merged, [
    { index: 0, length: 4 },
    { index: 5, length: 3 },
  ]);
});

test('mergeSpans 相邻但不重叠不合并', () => {
  assert.deepEqual(
    mergeSpans([
      { index: 0, length: 2 },
      { index: 2, length: 2 },
    ]),
    [
      { index: 0, length: 2 },
      { index: 2, length: 2 },
    ],
  );
});

test('buildAnnotatedSegments 基本切分', () => {
  const segs = buildAnnotatedSegments('abcdef', [{ index: 2, length: 2 }]);
  assert.deepEqual(segs, [
    { text: 'ab', highlighted: false },
    { text: 'cd', highlighted: true },
    { text: 'ef', highlighted: false },
  ]);
});

test('buildAnnotatedSegments 无 span 返回整段', () => {
  assert.deepEqual(buildAnnotatedSegments('abc', []), [{ text: 'abc', highlighted: false }]);
});

test('buildAnnotatedSegments span 在开头/结尾', () => {
  assert.deepEqual(buildAnnotatedSegments('abc', [{ index: 0, length: 1 }]), [
    { text: 'a', highlighted: true },
    { text: 'bc', highlighted: false },
  ]);
  assert.deepEqual(buildAnnotatedSegments('abc', [{ index: 2, length: 1 }]), [
    { text: 'ab', highlighted: false },
    { text: 'c', highlighted: true },
  ]);
});
