// 博客三语对齐（2026-10-24）：英文首页上出现了中文标签「思考」。作者要求：三语页面不许再有没翻译的文字。
// 标签以前是一个字符串、三语页面原样显示；现在是 {zh, ja, en}，上架时缺一种就拦下。
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { tagLabel, tagObject } from '../js/shared/blog-tags.js';
import { publishProblem } from '../js/shared/blog-posts-model.js';
import { buildArticle, normalizeTag } from '../workers/sdf-admin/src/blog.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const LANGS = ['zh', 'ja', 'en'];
const t3 = (s) => ({ zh: s + '中', ja: s + '日', en: s + 'en' });

// 已上线的文章本身：标题・正文・标签三语齐全（标签可以不填，填了就是三语对象）
test('posts.json 每篇的标题・正文・标签都是三语齐全', () => {
  const posts = JSON.parse(read('solutions/blog/posts.json'));
  assert.ok(posts.length >= 1, '护栏自身有效：至少有一篇');
  for (const p of posts) {
    for (const l of LANGS) {
      assert.ok(String(p.title?.[l] || '').trim(), `${p.slug} 缺 ${l} 标题`);
      assert.ok(String(p.body?.[l] || '').trim(), `${p.slug} 缺 ${l} 正文`);
    }
    if (!p.tag) continue;
    assert.equal(
      typeof p.tag,
      'object',
      `${p.slug} 的标签是单语字符串「${p.tag}」——三语页面会显示同一种语言`,
    );
    for (const l of LANGS) assert.ok(String(p.tag[l] || '').trim(), `${p.slug} 的标签缺 ${l}`);
  }
});

test('tagLabel：三语对象按当前语言取；缺的退到日→中→英', () => {
  const tag = { zh: '思考', ja: '思考', en: 'Reflections' };
  assert.equal(tagLabel(tag, null, 'en'), 'Reflections');
  assert.equal(tagLabel(tag, null, 'zh'), '思考');
  assert.equal(tagLabel({ zh: '中', ja: '', en: '' }, null, 'en'), '中');
  assert.equal(tagLabel('', null, 'en'), '');
});

test('显示标签的页面都把当前语言传进去（不传就永远是日文）', () => {
  assert.match(read('index.html'), /tagLabel\(p\.tag, window\.sdfT, L\)/);
  assert.match(
    read('solutions/blog/index.html'),
    /sdfBlogTagLabel\(p\.tag, window\.sdfT, validLang\)/,
  );
});

test('上架检查：单语标签・缺语种的标签都拦下；不填或三语齐全放行', () => {
  const base = { date: '2025-03-15', title: t3('t'), body: t3('<p>b</p>') };
  const today = '2026-10-24';
  assert.match(publishProblem({ ...base, tag: '思考' }, today), /一种语言/);
  assert.match(
    publishProblem({ ...base, tag: { zh: '思考', ja: '思考', en: '' } }, today),
    /标签缺 en/,
  );
  assert.equal(
    publishProblem({ ...base, tag: { zh: '思考', ja: '思考', en: 'Reflections' } }, today),
    '',
  );
  assert.equal(publishProblem({ ...base, tag: { zh: '', ja: '', en: '' } }, today), '');
  assert.equal(publishProblem({ ...base, tag: '' }, today), '');
});

test('后台：旧的单语标签载入时放进中文框，日英留空等同步', () => {
  assert.deepEqual(tagObject('思考'), { zh: '思考', ja: '', en: '' });
  assert.deepEqual(tagObject(undefined), { zh: '', ja: '', en: '' });
  assert.deepEqual(tagObject({ zh: 'a', ja: 'b', en: 'c' }), { zh: 'a', ja: 'b', en: 'c' });
  assert.equal(normalizeTag({ zh: ' ', ja: '', en: '' }), '', '三种都空＝不填');
});

test('文章页：每种语言的数据里带自己的标签，切语言时眉题跟着换', () => {
  const listing = read('solutions/blog/index.html');
  const { html, entry } = buildArticle(
    {
      date: '2025-03-15',
      tag: { zh: ' 思考 ', ja: '思考', en: 'Reflections' },
      title: t3('T'),
      body: t3('<p>b</p>'),
    },
    { slug: '2025-03-15-0000', posts: [], listing },
  );
  assert.deepEqual(entry.tag, { zh: '思考', ja: '思考', en: 'Reflections' });
  const data = JSON.parse(
    html.match(/<script type="application\/json" id="article-data">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(data.en.tag, 'Reflections');
  assert.equal(data.zh.tag, '思考');
  assert.match(html, /id="article-eyebrow" data-date="2025-03-15">思考 · 2025-03-15</);
  assert.match(html, /eb\.textContent = \(d\.tag \? d\.tag \+ ' · ' : ''\) \+ eb\.dataset\.date/);
});
