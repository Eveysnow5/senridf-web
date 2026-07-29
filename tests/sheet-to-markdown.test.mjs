import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetRowsToMarkdown } from '../js/shared/sheet-to-markdown.js';

test('基本二维表转 markdown（表头+分隔+数据）', () => {
  const md = sheetRowsToMarkdown([
    ['项目', '2023', '2024'],
    ['营收', '100', '120'],
  ]);
  assert.equal(md, '| 项目 | 2023 | 2024 |\n| --- | --- | --- |\n| 营收 | 100 | 120 |');
});

test('空表 / 非数组返回空串', () => {
  assert.equal(sheetRowsToMarkdown([]), '');
  assert.equal(sheetRowsToMarkdown(null), '');
  assert.equal(sheetRowsToMarkdown('x'), '');
});

test('参差行按最大列数补齐', () => {
  const md = sheetRowsToMarkdown([['a', 'b', 'c'], ['1']]);
  assert.equal(md, '| a | b | c |\n| --- | --- | --- |\n| 1 |  |  |');
});

test('单元格含 | 被转义、换行变空格', () => {
  const md = sheetRowsToMarkdown([['a|b', 'c\nd']]);
  assert.equal(md, '| a\\|b | c d |\n| --- | --- |');
});

test('null/undefined 单元格变空串', () => {
  const md = sheetRowsToMarkdown([['x', null, undefined]]);
  assert.equal(md, '| x |  |  |\n| --- | --- | --- |');
});

test('只有一行时输出表头+分隔、无数据行', () => {
  const md = sheetRowsToMarkdown([['仅表头']]);
  assert.equal(md, '| 仅表头 |\n| --- |');
});
