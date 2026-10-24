// 2026-10-24 作者要求的四处：正文两端对齐、标题 PC 尽量一行、博客做成第一层导航、首页博客块＝最近三篇。
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { chooseTitleSize } from '../js/shared/blog-content.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// 「放得下」用宽度模型：标题宽 = 字数 × 字号 × 1.08（含字间距），栏宽 1100px。
const fitsWidth =
  (chars, width = 1100) =>
  (s) =>
    chars * s * 1.08 <= width;

test('标题字号：放得下就不动；略长就缩；缩到 60% 还放不下就保持原字号（换行）', () => {
  assert.equal(chooseTitleSize(44, fitsWidth(20)), null); // 20 字 × 44px 放得下
  const s = chooseTitleSize(44, fitsWidth(30)); // 30 字要缩到 ≤ 33px
  assert.ok(s !== null && s <= 33 && s >= 27, String(s));
  assert.equal(chooseTitleSize(44, fitsWidth(80)), null); // 80 字缩到 27px 也放不下 → 两行大字
});

test('导航：博客是第一层入口，不在「解决方案」下拉里（PC・手机）', () => {
  const js = read('js/main.js');
  const nav = js.slice(js.indexOf('const NAV_HTML'), js.indexOf('const FOOTER_HTML'));
  assert.match(nav, /<a href="solutions\/blog\/" class="nav__link" data-i18n="nav_blog">/);
  assert.doesNotMatch(nav, /nav__dropdown-link" data-i18n="nav_blog"/);
  assert.doesNotMatch(nav, /nav__mobile-child" data-i18n="nav_blog"/);
  assert.match(nav, /nav__mobile-parent nav__mobile-parent--link" data-i18n="nav_blog"/);
});

test('首页博客块：两个位置由 posts.json 填（摘要取 300 字），没有写死的栏目文案', () => {
  const html = read('index.html');
  assert.equal((html.match(/class="journal-item" hidden/g) || []).length, 2);
  assert.match(html, /const max = L === 'en' \? 600 : 300;/);
  assert.match(html, /full\.length > max \? full\.slice\(0, max\) \+ '…'/);
  assert.doesNotMatch(html, /journal[123]_(tag|name|desc)/);
  assert.match(html, /fetch\('\/solutions\/blog\/posts\.json'\)/);
  for (const n of [1, 2]) assert.match(html, new RegExp(`data-image-key="journal${n}_img"`));
});

test('正文三语两端对齐（文章页和后台编辑区共用这条样式）', () => {
  const css = read('css/main.css');
  const rule = css.slice(
    css.indexOf('.blog-post__body {'),
    css.indexOf('}', css.indexOf('.blog-post__body {')),
  );
  assert.match(rule, /text-align: justify/);
  assert.match(read('admin/blog/frame.html'), /css\/main\.css/);
});
