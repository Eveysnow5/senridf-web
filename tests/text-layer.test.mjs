import { test } from 'node:test';
import assert from 'node:assert';
import {
  assessTextLayer,
  describeTextLayer,
  findCaveat,
  TEXT_LAYER_THRESHOLDS,
} from '../js/shared/text-layer.js';

const scannedPages = (n) => Array.from({ length: n }, () => '');
const textPages = (n) => Array.from({ length: n }, (_, i) => `第 ${i + 1} 页 正文内容`.repeat(4));

test('assessTextLayer：正常 PDF 判为 text', () => {
  const a = assessTextLayer(textPages(40));
  assert.equal(a.kind, 'text');
  assert.equal(a.pages, 40);
  assert.equal(a.withText, 40);
  assert.equal(a.withoutText, 0);
});

// 这是 2026-08-13 韩红样本的形态：文字层抽出来是空的。
test('assessTextLayer：纯扫描件判为 scanned', () => {
  const a = assessTextLayer(scannedPages(33));
  assert.equal(a.kind, 'scanned');
  assert.equal(a.withText, 0);
  assert.equal(a.withoutText, 33);
});

test('assessTextLayer：扫描件里夹几页可读文本仍判 scanned', () => {
  const a = assessTextLayer([...scannedPages(28), ...textPages(2)]);
  assert.equal(a.kind, 'scanned');
  assert.equal(a.withoutText, 28);
});

test('assessTextLayer：文字层残缺判为 thin（可用但要提醒）', () => {
  const a = assessTextLayer([...scannedPages(6), ...textPages(4)]);
  assert.equal(a.kind, 'thin');
  assert.equal(a.withText, 4);
});

// 空白页/只有 logo 的封面不该被当成"有文字"，否则一份扫描件会被判成正常文件。
test('assessTextLayer：短到没信息量的页不算有文字层', () => {
  const a = assessTextLayer(['', '  \n ', '页', '第 3 页']);
  assert.equal(a.withText, 0);
  assert.equal(a.kind, 'scanned');
});

test('assessTextLayer：空输入与脏输入不炸', () => {
  assert.equal(assessTextLayer([]).kind, 'empty');
  assert.equal(assessTextLayer(null).kind, 'empty');
  assert.equal(assessTextLayer([null, undefined, 0]).kind, 'scanned');
});

test('describeTextLayer：正常文件不加噪声（返回空串）', () => {
  assert.equal(describeTextLayer(assessTextLayer(textPages(10))), '');
  assert.equal(describeTextLayer(null), '');
});

// 要害在最后半句：少了它，模型会诚实地报告"该文件中未提及"，而那句话本身就是错的。
test('describeTextLayer：扫描件说明必须写明"查不到不等于没有"', () => {
  const s = describeTextLayer(assessTextLayer(scannedPages(33)));
  assert.match(s, /33 页/);
  assert.match(s, /无文字层|没有文字层/);
  assert.match(s, /不等于文件里没有/);
});

test('findCaveat：扫描件的"未命中"被明确标成不可作证据', () => {
  const c = findCaveat(assessTextLayer(scannedPages(20)));
  assert.match(c, /查找对其无效/);
  assert.match(c, /不能作为/);
  assert.match(c, /20/);
});

test('findCaveat：正常文件不加尾注', () => {
  assert.equal(findCaveat(assessTextLayer(textPages(20))), '');
  assert.equal(findCaveat(undefined), '');
});

test('findCaveat：残缺文件给较弱的提醒，且带真实页数', () => {
  const c = findCaveat(assessTextLayer([...scannedPages(6), ...textPages(4)]));
  assert.match(c, /6\/10/);
  assert.match(c, /未命中不代表文件里没有/);
});

// 阈值是拍的（没有真实扫描件夹具可定标），所以说明文字必须自带可核对的数字——
// 万一阈值定歪，模型看到的仍是真实页数，不至于被一个错标签把话说反。
test('说明文字一律带可自证的页数，不是只有一个标签', () => {
  for (const pages of [scannedPages(5), [...scannedPages(6), ...textPages(4)]]) {
    const a = assessTextLayer(pages);
    assert.match(describeTextLayer(a), new RegExp(String(a.pages)));
    assert.match(findCaveat(a), new RegExp(String(a.withoutText)));
  }
});

test('阈值可见且有序，改动时不会静默失序', () => {
  const t = TEXT_LAYER_THRESHOLDS;
  assert.ok(t.SCANNED_MAX_RATIO < t.THIN_MAX_RATIO, 'scanned 阈值必须比 thin 更严');
  assert.ok(t.MIN_CHARS_PER_PAGE > 0);
});
