// Blog 后台草稿箱（2026-10-24）：列表合并与按钮可用性。期待值按作者描述的规则手写：
// 「完成」进草稿箱、「上架」后公众才看得到、「下架」回草稿箱。
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  mergeRows,
  rowActions,
  rowStatus,
  publishProblem,
  newDocId,
  docIdForSlug,
  previewDoc,
  blogImagePathOf,
  blogImagePaths,
  replaceBlogImages,
} from '../js/shared/blog-posts-model.js';
import {
  buildArticle,
  normalizeExcerpt,
  validatePublishPayload,
} from '../workers/sdf-admin/src/blog.js';

const t3 = (s) => ({ zh: s, ja: s, en: s });
const live = (slug, date) => ({ slug, date, tag: '', title: t3('线上' + slug), body: t3('x') });

test('三种状态：只在线上的旧文章、草稿、线上有未上架修改', () => {
  const rows = mergeRows(
    [live('2026-10-21-4b60', '2026-10-21'), live('2025-03-15-aaaa', '2025-03-15')],
    [
      { id: 'p_new1', date: '2025-06-01', title: t3('新草稿') },
      {
        id: 'p_2025-03-15-aaaa',
        slug: '2025-03-15-aaaa',
        date: '2025-03-15',
        title: t3('改过'),
        dirty: true,
      },
    ],
  );
  assert.deepEqual(
    rows.map((r) => [r.key, r.live, r.dirty, rowStatus(r).text, rowActions(r)]),
    [
      ['live:2026-10-21-4b60', true, false, '已上架', { canPublish: false, canUnpublish: true }],
      ['p_new1', false, false, '草稿', { canPublish: true, canUnpublish: false }],
      [
        'p_2025-03-15-aaaa',
        true,
        true,
        '已上架 · 有修改未上架',
        { canPublish: true, canUnpublish: true },
      ],
    ],
  );
});

test('下架后：草稿箱里有档、线上没有 → 回到草稿，可再上架', () => {
  const rows = mergeRows(
    [],
    [{ id: 'p_x', slug: '2026-10-21-4b60', date: '2026-10-21', title: t3('a') }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rowStatus(rows[0]).text, '草稿');
  assert.deepEqual(rowActions(rows[0]), { canPublish: true, canUnpublish: false });
});

test('线上的文章不会因为草稿箱里也有一份而出现两行', () => {
  const rows = mergeRows(
    [live('2026-10-21-4b60', '2026-10-21')],
    [{ id: 'p_2026-10-21-4b60', slug: '2026-10-21-4b60', date: '2026-10-21', title: t3('a') }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].docId, 'p_2026-10-21-4b60');
  assert.equal(rows[0].dirty, false); // 没改过：不用再上架
  assert.deepEqual(rowActions(rows[0]), { canPublish: false, canUnpublish: true });
});

test('dirty 只对线上的有意义：草稿本来就能上架', () => {
  const [r] = mergeRows([], [{ id: 'p_a', date: '2026-01-01', title: t3('a'), dirty: true }]);
  assert.equal(rowStatus(r).text, '草稿');
});

test('上架前检查：缺语种、日期不全、未来日期', () => {
  const ok = { date: '2025-03-15', title: t3('标题'), body: t3('<p>x</p>') };
  assert.equal(publishProblem(ok, '2026-10-24'), '');
  assert.match(
    publishProblem({ ...ok, title: { zh: '标题', ja: ' ', en: 'T' } }, '2026-10-24'),
    /^ja /,
  );
  assert.match(publishProblem({ ...ok, body: { zh: 'x', ja: 'x' } }, '2026-10-24'), /^en /);
  assert.match(publishProblem({ ...ok, date: '' }, '2026-10-24'), /没填完整/);
  assert.match(publishProblem({ ...ok, date: '2026-10-25' }, '2026-10-24'), /未来/);
  assert.equal(publishProblem({ ...ok, date: '2026-10-24' }, '2026-10-24'), ''); // 今天可以
});

test('草稿箱文档 id 不会和自动保存的 current 撞，也能放进 onclick 的引号里', () => {
  const ids = [newDocId(), newDocId(0, () => 0), docIdForSlug('2026-10-21-4b60')];
  for (const id of ids) {
    assert.match(id, /^p_[0-9a-z-]+$/);
    assert.notEqual(id, 'current');
  }
});

// Firestore 规则：草稿箱放在 blog_drafts 下，正是因为那里已经「只有管理员能读写」。
// 哪天有人把规则放宽，草稿（未公开的文章）就会被任何登录用户读到。
test('blog_drafts 仍然只有管理员能读写', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const m = rules.match(/match \/blog_drafts\/\{doc\} \{([\s\S]*?)\}/);
  assert.ok(m, '没找到 blog_drafts 的规则');
  assert.match(m[1].trim(), /^allow read, write: if isAdmin\(\);$/);
});

// ── 上架前预览：和上架同一个 buildArticle；弹窗只改 base 和统计脚本两处 ──
// 用仓库里真实的博客列表页读指纹（和 Worker 上架时读的是同一个文件）。
const LISTING = readFileSync(new URL('../solutions/blog/index.html', import.meta.url), 'utf8');
const draft = {
  date: '2025-03-15',
  tag: ' 思考 ',
  title: { zh: '中标题', ja: '日タイトル', en: 'EN title' },
  body: { zh: '<p>中</p>', ja: '<p>日</p>', en: '<p>en</p>' },
};

test('buildArticle：封面优先级 上传 > coverPath > 原有；标签去空格', () => {
  const posts = [{ slug: '2025-03-15-abcd', cover: 'assets/images/blog/old.webp' }];
  const at = (extra, opt = {}) =>
    buildArticle(
      { ...draft, ...extra },
      { slug: '2025-03-15-abcd', posts, listing: LISTING, ...opt },
    ).entry;
  assert.equal(at({}).cover, 'assets/images/blog/old.webp');
  assert.equal(
    at({ coverPath: 'assets/images/blog/inline-1-aa.webp' }).cover,
    'assets/images/blog/inline-1-aa.webp',
  );
  assert.equal(
    at({}, { coverUpload: 'AAAA' }).cover,
    'assets/images/blog/2025-03-15-abcd-cover.webp',
  );
  assert.equal(at({}).tag, '思考');
});

// 2026-10-24 作者：封面传上去就删不掉——以前没给 coverPath 就沿用线上旧封面，后台删了也没用
test('buildArticle：coverPath 写明 null＝删掉封面；文章页不出封面图', () => {
  const posts = [{ slug: '2025-03-15-abcd', cover: 'assets/images/blog/old.webp' }];
  const r = buildArticle(
    { ...draft, coverPath: null },
    { slug: '2025-03-15-abcd', posts, listing: LISTING },
  );
  assert.equal(r.entry.cover, null);
  assert.doesNotMatch(r.html, /blog-post__cover/);
  const page = readFileSync(new URL('../admin/blog/index.html', import.meta.url), 'utf8');
  assert.match(page, /payload\.coverPath = d\.cover \|\| null;/, '后台上架时没写明 coverPath');
  assert.match(page, /function removeCover\(\)/);
});

test('还没上线的博客图片：识别路径、只替换给了地址的那几张', () => {
  assert.equal(
    blogImagePathOf('/assets/images/blog/inline-1-a.webp'),
    'assets/images/blog/inline-1-a.webp',
  );
  assert.equal(
    blogImagePathOf('https://www.senridf.com/assets/images/blog/x-cover.webp'),
    'assets/images/blog/x-cover.webp',
  );
  assert.equal(blogImagePathOf('/assets/images/site/a.webp'), null);
  assert.equal(blogImagePathOf('data:image/webp;base64,AAAA'), null);
  // 文章页里的图在 JSON 字符串中（引号被转义），封面在 img 标签里，两处都要认出来
  const html =
    '<img src="/assets/images/blog/c.webp" class="blog-post__cover">' +
    '<script type="application/json">{"zh":{"body":"<img src=\\"/assets/images/blog/a.webp\\">' +
    '<img src=\\"/assets/images/blog/b.webp\\">"}}</script>';
  assert.deepEqual(blogImagePaths(html), [
    'assets/images/blog/c.webp',
    'assets/images/blog/a.webp',
    'assets/images/blog/b.webp',
  ]);
  const out = replaceBlogImages(html, {
    'assets/images/blog/a.webp': 'data:image/webp;base64,QQ==',
  });
  assert.ok(out.includes('src=\\"data:image/webp;base64,QQ==\\"'));
  assert.ok(
    out.includes('/assets/images/blog/b.webp') && out.includes('/assets/images/blog/c.webp'),
  );
  assert.ok(!out.includes('/assets/images/blog/a.webp'));
});

test('buildArticle：读不到资源指纹就报错（不生成会白屏的页面）', () => {
  assert.throws(
    () => buildArticle(draft, { slug: '2025-03-15-abcd', posts: [], listing: '' }),
    /资源指纹/,
  );
});

test('预览＝上架页面只改两处：base 指向站点根、没有统计脚本', () => {
  const { html } = buildArticle(draft, { slug: '2025-03-15-0000', posts: [], listing: LISTING });
  const pv = previewDoc(html);
  assert.ok(pv.includes('<base href="/">') && !pv.includes('../../'));
  assert.ok(!/tracking\.js/.test(pv));
  // 其余一字不差：把两处改回去就等于原文
  const back = pv.replace('<base href="/">', '<base href="../../">');
  const trackingLine = html.match(
    /\n[ \t]*<script type="module" src="js\/tracking\.js[^"]*"><\/script>/,
  )[0];
  assert.equal(html.replace(trackingLine, ''), back);
  // 内容真的在里面，资源都带指纹（和线上一样走缓存版本）
  assert.ok(pv.includes('日タイトル') && pv.includes('EN title'));
  assert.match(pv, /css\/main\.css\?v=[0-9a-f]{10}/);
  assert.match(pv, /js\/main\.js\?v=[0-9a-f]{10}/);
});

test('模板变了找不到要改的地方 → 报错，不给一个和线上不一样的预览', () => {
  assert.throws(() => previewDoc('<html><base href="./"></html>'), /模板变了/);
  assert.throws(() => previewDoc('<html><base href="../../"></html>'), /统计脚本/);
});

// 2026-10-24：首页摘要可在后台单独写；留空就由首页从正文自动取
test('首页摘要：三语都空不写进 posts.json；填了去空白存下；只填一部分上架被拦', () => {
  assert.equal(normalizeExcerpt(null), null);
  assert.equal(normalizeExcerpt({ zh: ' ', ja: '', en: '' }), null);
  assert.deepEqual(normalizeExcerpt({ zh: ' 中 ', ja: '日', en: 'en ' }), {
    zh: '中',
    ja: '日',
    en: 'en',
  });
  const at = (extra) =>
    buildArticle({ ...draft, ...extra }, { slug: '2025-03-15-abcd', posts: [], listing: LISTING })
      .entry;
  assert.equal('excerpt' in at({}), false);
  assert.equal('excerpt' in at({ excerpt: { zh: '', ja: '', en: '' } }), false);
  assert.deepEqual(at({ excerpt: { zh: '摘', ja: '要', en: 'ex' } }).excerpt, {
    zh: '摘',
    ja: '要',
    en: 'ex',
  });
  assert.equal(validatePublishPayload({ ...draft, excerpt: 'x' }).ok, false);
  assert.equal(validatePublishPayload({ ...draft, excerpt: { zh: 'a'.repeat(1501) } }).ok, false);
  assert.equal(
    validatePublishPayload({ ...draft, excerpt: { zh: '摘', ja: '要', en: 'ex' } }).ok,
    true,
  );
  const full = { title: t3('t'), body: t3('<p>b</p>'), date: '2025-03-15' };
  assert.equal(
    publishProblem({ ...full, excerpt: { zh: '摘', ja: '', en: '' } }, '2026-10-24'),
    '首页摘要缺 ja・en（编辑后可点「一键同步日英」，或把摘要全部清空改用自动摘要）',
  );
  assert.equal(publishProblem({ ...full, excerpt: { zh: '', ja: '', en: '' } }, '2026-10-24'), '');
  assert.equal(
    publishProblem({ ...full, excerpt: { zh: '摘', ja: '要', en: 'ex' } }, '2026-10-24'),
    '',
  );
  const page = readFileSync(new URL('../admin/blog/index.html', import.meta.url), 'utf8');
  assert.match(page, /if \(d\.excerpt\) payload\.excerpt = d\.excerpt;/, '上架时没带首页摘要');
  assert.match(page, /key: 'excerpt'/, '一键同步日英没带首页摘要');
});
