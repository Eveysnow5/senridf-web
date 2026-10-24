// Blog 模块纯逻辑（无 IO）：slug 生成、发布载荷校验、posts.json 增删改、文章 HTML 模板渲染、sitemap 增删。
// 供 sdf-admin Worker 的 /blog/* 路由使用。

import { MAX_IMAGE_BYTES } from './images.js'; // 封面图大小上限与网站图片/Blog插图统一，避免三处限制不一致
import { FONT_CSS_URL, plainExcerpt } from '../../../js/shared/blog-content.js';
import {
  ORIGIN,
  apply as applyHeadMeta,
  blogArticleFile,
  blogArticleRoute,
} from '../../../scripts/qa/head-meta-core.mjs';
import { applyFingerprints, readFingerprints } from '../../../scripts/qa/cache-bust-core.mjs';

// 文章页引用的共用资源（都要带 ?v= 指纹）。Worker 从博客列表页读这几个的当前指纹，
// 所以列表页必须引用到全部（tests/blog-article.test.mjs 校验）。
export const ARTICLE_ASSETS = [
  'css/main.css',
  'js/main.js',
  'js/tracking.js',
  'js/shared/blog-content.js',
];
// 已上传到仓库的博客图片（/blog/image 的 inline-…webp，或发布时生成的 …-cover.webp）
export const COVER_PATH_RE = /^assets\/images\/blog\/[A-Za-z0-9-]+\.webp$/;
export const LISTING_PATH = 'solutions/blog/index.html';
export const SITEMAP_PATH = 'sitemap.xml';

export function generateSlug(date, randomFn = Math.random) {
  const hex = Math.floor(randomFn() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `${date}-${hex}`;
}

export function validatePublishPayload(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: '请求格式错误' };
  const { tag, date, title, body: postBody, cover } = body;
  // 标签可留空。2026-10-24 起是三语对象 {zh, ja, en}（旧的单语字符串仍收，前端上架时会拦）。
  if (tag !== undefined && tag !== null) {
    const parts =
      typeof tag === 'string'
        ? [tag]
        : typeof tag === 'object'
          ? ['zh', 'ja', 'en'].map((l) => tag[l])
          : null;
    if (!parts || parts.some((v) => v !== undefined && v !== null && typeof v !== 'string')) {
      return { ok: false, error: '标签格式错误' };
    }
    if (parts.some((v) => typeof v === 'string' && v.length > 40)) {
      return { ok: false, error: '标签太长（40 字以内）' };
    }
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: '日期格式错误' };
  }
  for (const lang of ['ja', 'zh', 'en']) {
    if (!title || typeof title[lang] !== 'string' || !title[lang].trim()) {
      return { ok: false, error: `缺少${lang}标题` };
    }
    if (!postBody || typeof postBody[lang] !== 'string' || !postBody[lang].trim()) {
      return { ok: false, error: `缺少${lang}正文` };
    }
  }
  if (cover !== undefined && cover !== null) {
    if (typeof cover !== 'string') return { ok: false, error: '封面图格式错误' };
    const stripped = cover.replace(/^data:image\/\w+;base64,/, '');
    const approxBytes = Math.floor((stripped.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) return { ok: false, error: '封面图过大' };
  }
  // 草稿箱（2026-10-24）：封面在「完成」时已经经 /blog/image 传进仓库，上架时只给路径。
  const { coverPath } = body;
  if (coverPath !== undefined && coverPath !== null) {
    if (typeof coverPath !== 'string' || !COVER_PATH_RE.test(coverPath)) {
      return { ok: false, error: '封面图路径格式错误' };
    }
  }
  return { ok: true };
}

// 由发布载荷生成文章条目和文章页 HTML。上架（/blog/publish）和上架前预览（/blog/preview）
// 都走这一个函数——预览「严格跟发布页一致」靠的就是这一点，别在任一边另写一份。
// listing：博客列表页的当前内容（从中读资源指纹）；posts：当前 posts.json；
// coverUpload：这次随载荷上传的封面（base64），有就用 <slug>-cover.webp。
export function buildArticle(body, { slug, posts, listing, coverUpload = null }) {
  const existing = posts.find((p) => p.slug === slug);
  const want = readFingerprints(listing || '', ARTICLE_ASSETS);
  const lacking = ARTICLE_ASSETS.filter((a) => !want[a]);
  // 读不到指纹就停：写出没有 ?v= 的页面只会被上线检查拦下，作者看到的是「发布成功但前台空白」
  if (lacking.length) throw new Error(`读不到资源指纹（${lacking.join('、')}），文章页没法生成`);
  const cover = coverUpload
    ? `assets/images/blog/${slug}-cover.webp`
    : body.coverPath || (existing && existing.cover) || null;
  const entry = {
    slug,
    date: body.date,
    tag: normalizeTag(body.tag),
    title: body.title,
    body: body.body,
    cover,
  };
  return { entry, html: renderArticleHtml(entry, want) };
}

// 标签：三语对象各自去空格；三种都空＝不填（''）；旧的字符串去空格原样。
export function normalizeTag(tag) {
  if (tag && typeof tag === 'object') {
    const o = {};
    for (const l of ['zh', 'ja', 'en']) o[l] = typeof tag[l] === 'string' ? tag[l].trim() : '';
    return o.zh || o.ja || o.en ? o : '';
  }
  return typeof tag === 'string' ? tag.trim() : '';
}

const tagIn = (tag, lang) => (tag && typeof tag === 'object' ? tag[lang] || '' : tag || '');

// posts.json 是数组；按 slug 去重插入/更新，按 date 倒序排列。
export function upsertPost(posts, entry) {
  const filtered = posts.filter((p) => p.slug !== entry.slug);
  filtered.push(entry);
  filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return filtered;
}

export function removePost(posts, slug) {
  return posts.filter((p) => p.slug !== slug);
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── sitemap：文章是公开内容页，发布时加进去、下架时拿掉（tests/sitemap.test.mjs 校验两边对应）──
export function articleUrl(slug) {
  return ORIGIN + blogArticleRoute(slug);
}

export function addToSitemap(xml, slug, lastmod) {
  const loc = articleUrl(slug);
  const without = removeFromSitemap(xml, slug);
  const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`;
  if (!/<\/urlset>/.test(without)) throw new Error('sitemap.xml 格式异常（缺 </urlset>）');
  return without.replace(/<\/urlset>/, entry + '</urlset>');
}

export function removeFromSitemap(xml, slug) {
  const loc = articleUrl(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return xml.replace(new RegExp(`[ \\t]*<url>\\s*<loc>${loc}</loc>[\\s\\S]*?</url>\\n?`, 'g'), '');
}

// 文章页 HTML 模板。ARTICLE 数据内嵌三语内容，客户端用 js/shared/blog-content.js 的 bodyToHtml
// （marked + DOMPurify，与后台编辑器同一套过滤）渲染——Worker 没有 DOM，服务端跑不了 DOMPurify。
//
// want：各共用资源当前的指纹（Worker 从博客列表页读出，见 index.js）。写进 ?v=，否则上线检查
// （tests/cache-bust.test.mjs）必红、文章上不了线——2026-10-21 实际发生过。
// head 里的规范网址・分享卡片由 head-meta-core 生成，与 npm run meta 同一个函数。
export function renderArticleHtml({ slug, date, tag, title, body, cover }, want = {}) {
  // 标签按语言放进各自那份数据，切语言时和标题一起换（2026-10-24 之前三语页面显示同一个标签）
  const articleData = {
    ja: { title: title.ja, body: body.ja, tag: tagIn(tag, 'ja') },
    zh: { title: title.zh, body: body.zh, tag: tagIn(tag, 'zh') },
    en: { title: title.en, body: body.en, tag: tagIn(tag, 'en') },
  };
  // </script> 若原样出现在 JSON 里会提前截断 <script> 标签，转成 unicode 转义防止。
  const articleJson = JSON.stringify(articleData).replace(/</g, '\\u003c');
  const coverImg = cover ? `<img src="/${cover}" alt="" class="blog-post__cover">` : '';
  // 首屏（无脚本时）先放日文标签；脚本按当前语言换。translate="no"：不让浏览器翻译插件乱改。
  const tagText = tagIn(tag, 'ja');
  const eyebrow = `${tagText ? escapeHtml(tagText) + ' · ' : ''}${escapeHtml(date)}`;
  const desc = plainExcerpt(body.ja, 120);

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title.ja)} — 千里同風株式会社</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONT_CSS_URL}" rel="stylesheet">
  <base href="../../">
  <link rel="stylesheet" href="css/main.css">
  <script defer src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js" integrity="sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dompurify@3.4.16/dist/purify.min.js" integrity="sha384-a7SzOxErzJ3ZpQz0zJ32d67dSitNzPcbfybc/ykU9KJhMgZkwqfSxlhhdJRS+XGL" crossorigin="anonymous"></script>
</head>
<body>

  <div id="nav-placeholder"></div>

  <main>
    <div class="page-header">
      <div class="page-header__container">
        <div data-animate>
          <span class="section__eyebrow" translate="no" id="article-eyebrow" data-date="${escapeHtml(date)}">${eyebrow}</span>
          <h1 class="section__title" id="article-title"></h1>
        </div>
      </div>
    </div>
    <section class="section blog-post">
      ${coverImg}
      <div id="article-body" class="blog-post__body"></div>
    </section>
  </main>

  <div id="footer-placeholder"></div>

  <script src="js/main.js"></script>
  <script type="module" src="js/tracking.js"></script>
  <script type="application/json" id="article-data">${articleJson}</script>
  <script type="module">
    import { bodyToHtml, fitTitle } from '/js/shared/blog-content.js';
    const ARTICLE = JSON.parse(document.getElementById('article-data').textContent);
    const titleEl = document.getElementById('article-title');
    function renderArticle(lang) {
      const d = ARTICLE[lang] || ARTICLE.ja;
      titleEl.textContent = d.title;
      fitTitle(titleEl);
      const eb = document.getElementById('article-eyebrow');
      eb.textContent = (d.tag ? d.tag + ' · ' : '') + eb.dataset.date;
      document.getElementById('article-body').innerHTML = bodyToHtml(d.body, window);
      document.title = d.title + ' — ' + (lang === 'en' ? 'Senridoufuu Co., Ltd.' : '千里同風株式会社');
    }
    // 标题一行放不放得下取决于窗口宽度和网页字体（晚到会变宽），这两种时机都重算
    let fitTimer;
    window.addEventListener('resize', () => {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(() => fitTitle(titleEl), 150);
    });
    if (document.fonts) document.fonts.ready.then(() => fitTitle(titleEl));
    const _switchLang = window.switchLang;
    window.switchLang = function (lang) {
      _switchLang(lang);
      renderArticle(lang);
    };
    renderArticle(typeof currentLang === 'string' ? currentLang : 'ja');
  </script>
</body>
</html>
`;
  const file = blogArticleFile(slug);
  const withMeta = applyHeadMeta(file, html, { [file]: blogArticleRoute(slug) });
  return applyFingerprints(withMeta, want).out;
}
