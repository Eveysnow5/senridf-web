import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderArticleHtml,
  validatePublishPayload,
  addToSitemap,
  removeFromSitemap,
  ARTICLE_ASSETS,
  LISTING_PATH,
} from '../workers/sdf-admin/src/blog.js';
import { readFingerprints, applyFingerprints } from '../scripts/qa/cache-bust-core.mjs';
import { fingerprint } from '../scripts/qa/cache-bust.mjs';
import {
  apply as applyHeadMeta,
  blogArticleFile,
  blogArticleRoute,
} from '../scripts/qa/head-meta-core.mjs';
import {
  FONT_CSS_URL,
  isHtml,
  plainExcerpt,
  tagSequence,
  PURIFY_CONFIG,
} from '../js/shared/blog-content.js';

// 后台发布的 blog 文章页（2026-10-22）。
//
// 起因：10-21 作者在后台点了发布，Worker 生成的文章页缺 ?v= 指纹、缺 head 信息、不在暴露面清单和 sitemap 里，
// 上线检查（sync-upstream.yml 镜像前跑 npm run check）拦下，前台一直空白。各项检查都只扫 git 已跟踪的文件，
// 而我验证闸门时只走了「手动推送」这条路，没走「后台生成文件」这条——两条路产出的页面不一样。
// 这里钉住「Worker 写出来的页面，就是 npm run bust / npm run meta 会写的页面」。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

const SAMPLE = {
  slug: '2026-10-22-abcd',
  date: '2026-10-22',
  tag: '思考',
  title: { ja: '日本語のタイトル', zh: '中文标题', en: 'English title' },
  body: {
    ja: '<p>本文です。<span style="color: rgb(180, 35, 24);">赤い字</span></p>',
    zh: '<p>正文。<span style="color: rgb(180, 35, 24);">红字</span></p>',
    en: '<p>Body. <span style="color: rgb(180, 35, 24);">Red</span></p>',
  },
  cover: null,
};

const want = Object.fromEntries(ARTICLE_ASSETS.map((a) => [a, fingerprint(a)]));

test('★ 博客列表页引用了文章页要用的全部资源，且带着当前指纹（Worker 从这里读）', () => {
  const got = readFingerprints(read(LISTING_PATH), ARTICLE_ASSETS);
  assert.deepEqual(got, want, '列表页缺了某个资源的引用，或指纹过期（npm run bust）');
});

test('★ 生成的文章页：指纹齐全且是当前值（npm run bust 不会再改它）', () => {
  const html = renderArticleHtml(SAMPLE, want);
  const again = applyFingerprints(
    html,
    Object.fromEntries(ARTICLE_ASSETS.map((a) => [a, want[a]])),
  );
  assert.equal(again.stale.length, 0, again.stale.join('\n'));
  assert.equal(again.refs, ARTICLE_ASSETS.length, '文章页引用的共用资源数不对');
});

test('★ 生成的文章页：head 信息就是 npm run meta 会写的（规范网址・分享卡片）', () => {
  const html = renderArticleHtml(SAMPLE, want);
  const file = blogArticleFile(SAMPLE.slug);
  assert.equal(applyHeadMeta(file, html, { [file]: blogArticleRoute(SAMPLE.slug) }), html);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/www\.senridf\.com\/solutions\/blog\/2026-10-22-abcd">/,
  );
  assert.match(html, /<meta name="description" content="本文です。赤い字">/);
});

test('标签：可留空；留空时只显示日期；作者原样写的标签标 translate="no"', () => {
  assert.equal(validatePublishPayload({ ...SAMPLE, tag: '' }).ok, true);
  assert.equal(validatePublishPayload({ ...SAMPLE, tag: undefined }).ok, true);
  assert.equal(validatePublishPayload({ ...SAMPLE, tag: 3 }).ok, false);
  assert.match(renderArticleHtml(SAMPLE, want), /translate="no">思考 · 2026-10-22</);
  assert.match(renderArticleHtml({ ...SAMPLE, tag: '' }, want), /translate="no">2026-10-22</);
});

test('正文 HTML 不会截断内嵌数据（</script> 被转义）', () => {
  const html = renderArticleHtml(
    { ...SAMPLE, body: { ...SAMPLE.body, ja: '<p></script><script>alert(1)</script></p>' } },
    want,
  );
  const data = html.match(
    /<script type="application\/json" id="article-data">([\s\S]*?)<\/script>/,
  )[1];
  assert.ok(!data.includes('</script'), '正文里的 </script> 会提前结束数据块');
  assert.equal(JSON.parse(data).ja.body, '<p></script><script>alert(1)</script></p>');
});

test('sitemap：发布加入、重复发布不重复、下架移除', () => {
  const xml = read('sitemap.xml');
  const once = addToSitemap(xml, SAMPLE.slug, SAMPLE.date);
  const twice = addToSitemap(once, SAMPLE.slug, SAMPLE.date);
  const loc = 'https://www.senridf.com/solutions/blog/2026-10-22-abcd';
  assert.equal(once.split(loc).length - 1, 1);
  assert.equal(twice, once);
  assert.equal(removeFromSitemap(once, SAMPLE.slug), xml);
});

test('★ 编辑区和文章页加载同一组字体（否则「编辑时看到的」≠「发布后的」）', () => {
  assert.ok(read('admin/blog/frame.html').includes(`href="${FONT_CSS_URL}"`));
  assert.ok(renderArticleHtml(SAMPLE, want).includes(FONT_CSS_URL));
  assert.match(
    read('admin/blog/frame.html'),
    /href="\/css\/main\.css\?v=/,
    '编辑区要加载同一份 main.css',
  );
  assert.match(read('admin/blog/frame.html'), /id="ed" class="blog-post__body"/);
  assert.match(renderArticleHtml(SAMPLE, want), /id="article-body" class="blog-post__body"/);
});

test('★ 编辑器与文章页用同一个 marked / DOMPurify（同版本同 SRI）', () => {
  const libs = (s) =>
    [
      ...s.matchAll(
        /<script defer src="(https:\/\/cdn\.jsdelivr\.net\/npm\/(?:marked|dompurify)[^"]+)" integrity="([^"]+)"/g,
      ),
    ].map((m) => m[1] + ' ' + m[2]);
  const admin = libs(read('admin/blog/index.html'));
  const article = libs(renderArticleHtml(SAMPLE, want));
  assert.equal(article.length, 2);
  assert.deepEqual(admin, article);
});

test('正文工具：HTML/Markdown 判别、摘要去标签、标签序列', () => {
  assert.equal(isHtml('<p>a</p>'), true);
  assert.equal(isHtml('## 小标题\n正文'), false);
  assert.equal(plainExcerpt('<h2>标题</h2><p>正&amp;文<br>二</p>'), '标题 正&文 二');
  assert.equal(plainExcerpt('**加粗** 文字'), '加粗 文字');
  assert.deepEqual(tagSequence('<p>a<span style="x">b</span></p>'), ['p', 'span', '/span', '/p']);
  assert.ok(PURIFY_CONFIG.ALLOWED_ATTR.includes('style'), '不允许 style 的话字体・颜色全丢');
  assert.ok(!PURIFY_CONFIG.ALLOWED_TAGS.includes('script'));
});

test('旧 Markdown 稿：行首缩进不再变成代码块（第一篇「关于X：」五段被截断的原因）', async () => {
  const { markdownForBlog } = await import('../js/shared/blog-content.js');
  assert.equal(markdownForBlog('    关于AI：**重点**\n\n正文'), '关于AI：**重点**\n\n正文');
  assert.equal(markdownForBlog('```\n    code\n```'), '```\n    code\n```');
});
