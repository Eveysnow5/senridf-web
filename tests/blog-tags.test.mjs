import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_TAGS, tagLabel, knownTags } from '../js/shared/blog-tags.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

const fakeT = (k) => ({ blog_tag_ai_hardware: 'AI & Hardware', blog_tag_news: 'News' })[k] || k;

test('已知分类走 i18n', () => {
  assert.equal(tagLabel('ai_hardware', fakeT), 'AI & Hardware');
  assert.equal(tagLabel('news', fakeT), 'News');
});

// 回退是刻意保留的：一次性分类不该逼作者先改代码才能发文。
test('未知分类原样显示，不吞掉也不报错', () => {
  assert.equal(tagLabel('临时专题', fakeT), '临时专题');
  assert.equal(tagLabel('  留白  ', fakeT), '留白');
});

test('空值与脏值返回空串，不渲染出 undefined', () => {
  for (const v of ['', '   ', null, undefined, 42, {}]) {
    assert.equal(tagLabel(v, fakeT), '');
  }
});

test('没有传 t 时退回原始值，不炸', () => {
  assert.equal(tagLabel('ai_hardware'), 'ai_hardware');
});

// ⚠️ 表里每个 key 都必须在 T 的三个语种里存在，否则那个语种会静默显示键名。
test('每个已知分类在 ja/zh/en 三语里都有文案', () => {
  const keys = Object.values(BLOG_TAGS);
  assert.ok(keys.length >= 3, `分类太少（${keys.length}），护栏形同虚设`);
  for (const k of keys) {
    const hits = MAIN.split(`    ${k}: '`).length - 1;
    assert.equal(hits, 3, `${k} 在 T 里出现 ${hits} 次，应为 3（ja/zh/en 各一）`);
  }
});

test('knownTags 与映射表一致', () => {
  assert.deepEqual(knownTags(), Object.keys(BLOG_TAGS));
});

/* ── 接线护栏 ───────────────────────────────────────────────────────────── */

const BLOG = readFileSync(path.join(ROOT, 'solutions', 'blog', 'index.html'), 'utf8');
const ADMIN = readFileSync(path.join(ROOT, 'admin', 'blog', 'index.html'), 'utf8');

test('博客列表按当前语言渲染分类，而不是直接吐原始值', () => {
  assert.match(BLOG, /window\.sdfBlogTagLabel\(p\.tag, window\.sdfT\)/);
  // 老写法：直接 escapeHtmlList(p.tag)，日英页因此显示中文分类
  assert.doesNotMatch(BLOG, /blog-item__tag">\$\{escapeHtmlList\(p\.tag\)\}/);
});

// 2026-10-22 作者要求：标签不设下拉，手工输入或留白。原来的「下拉 key 都在映射表里」
// 「保留自定义输入回退」两条随下拉一起删除；映射表仍保留，给已经用 key 发布过的旧文章翻三语。
test('后台标签是自由输入框（不是下拉），可留空', () => {
  assert.match(ADMIN, /<input type="text" id="compose-tag"/);
  assert.doesNotMatch(ADMIN, /id="compose-tag-select"/);
  assert.ok(Object.keys(BLOG_TAGS).length >= 3, '旧分类的三语映射还要留着');
});

// 真实渲染里抓到的：分类曾显示成原始 key `AI_HARDWARE`。
// 因为挂 window.sdfBlogTagLabel 的是**模块**脚本（defer），而首次渲染跑在它前面。
// 生产环境 fetch 慢一点就"碰巧正常"——这种靠时序侥幸的代码不能留。
test('首次渲染要等到桥就绪（不赌 fetch 比 defer 脚本慢）', () => {
  assert.match(BLOG, /document\.readyState === 'loading'/);
  assert.match(BLOG, /DOMContentLoaded', \(\) => renderBlogCards\(currentLang\)/);
});
