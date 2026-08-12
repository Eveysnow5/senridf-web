// 图像路径在文件多的时候会退化成"每份 1 页"，那时它比文本路径更差。
//
// 2026-08-12 实测（地铁研究样本，6 份年报，问"对政府补助的依赖有多大"）：
//   · 每份图像预算 = floor(800KB / 6) = 133KB，而单页 JPEG 实测 92–179KB
//   · renderPagesToImages 里 `used &&` 保证至少送一页 → **每份正好 1 页**
//   · 北京地铁年报 75 页，模型看到 1 页，而且是第 31 页（债券条款），全不相关
//   · 走图像路径的文件**不发 content 字段**，所以那份文件的文本是零
// 结果：6 份里 4 份哑掉，模型只能答"所提供的片段中未包含"。
//
// 1 页猜错不是"少看几页"，是**这份文件归零**。而文本路径至少能在全文里按提问 IDF
// 检索。所以预算撑不起 2 页时，整次请求退回文本——不是退化，是选更好的那条路。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagePathViable, IMG_MIN_PER_FILE } from '../js/shared/image-path-viable.js';

const BUDGET = 800 * 1024;

test('文件少时照常走图像路径（这是它擅长的场景）', () => {
  assert.equal(imagePathViable(1, BUDGET), true);
  assert.equal(imagePathViable(2, BUDGET), true);
  assert.equal(imagePathViable(3, BUDGET), true);
});

test('4 份以上不走图像路径——每份只剩 1 页，还不如全文检索', () => {
  // 地铁样本实测就是 5 份（当时上限 5，作者传的第 6 份被静默丢弃）：
  // floor(800KB/5)=160KB，而 2 页要 184KB 起 → 每份 1 页，5 份里 3 份哑掉。
  assert.equal(imagePathViable(4, BUDGET), false);
  assert.equal(imagePathViable(5, BUDGET), false);
  assert.equal(imagePathViable(6, BUDGET), false);
});

test('临界点由"够不够 2 页"决定，不是拍脑袋的文件数上限', () => {
  // 阈值 = 2 × 单页中位体积（约 130KB）；预算 800KB 时恰好容得下 3 份，
  // 与实测记录「3 份各约 2 页」对得上。
  assert.equal(Math.floor(BUDGET / IMG_MIN_PER_FILE), 3);
  assert.equal(imagePathViable(4, BUDGET), false, '第 4 份就撑不起 2 页了');
});

test('预算变大时阈值跟着变——写死文件数就会在调预算时悄悄失效', () => {
  assert.equal(imagePathViable(6, 2 * 1024 * 1024), true, '预算翻倍后 6 份也够');
  assert.equal(imagePathViable(3, 700 * 1024), false, '预算砍小后 3 份就不够');
});

test('0 份或非法输入不炸，且不假装可行', () => {
  assert.equal(imagePathViable(0, BUDGET), false);
  assert.equal(imagePathViable(-1, BUDGET), false);
  assert.equal(imagePathViable(NaN, BUDGET), false);
  assert.equal(imagePathViable(2, 0), false);
});
