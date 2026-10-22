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
import { applyFingerprints } from '../../../scripts/qa/cache-bust-core.mjs';

// 文章页引用的共用资源（都要带 ?v= 指纹）。Worker 从博客列表页读这几个的当前指纹，
// 所以列表页必须引用到全部（tests/blog-article.test.mjs 校验）。
export const ARTICLE_ASSETS = [
  'css/main.css',
  'js/main.js',
  'js/tracking.js',
  'js/shared/blog-content.js',
];
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
  // 标签可留空（2026-10-22 作者要求：不设下拉、手工输入或留白）；给了就必须是字符串。
  if (tag !== undefined && tag !== null && typeof tag !== 'string') {
    return { ok: false, error: '标签格式错误' };
  }
  if (typeof tag === 'string' && tag.length > 40)
    return { ok: false, error: '标签太长（40 字以内）' };
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
  return { ok: true };
}

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
  const articleData = {
    ja: { title: title.ja, body: body.ja },
    zh: { title: title.zh, body: body.zh },
    en: { title: title.en, body: body.en },
  };
  // </script> 若原样出现在 JSON 里会提前截断 <script> 标签，转成 unicode 转义防止。
  const articleJson = JSON.stringify(articleData).replace(/</g, '\\u003c');
  const coverImg = cover ? `<img src="/${cover}" alt="" class="blog-post__cover">` : '';
  const tagText = typeof tag === 'string' ? tag.trim() : '';
  // 标签是作者原样写的文字（不翻译），标 translate="no"：公开页 i18n 检查据此放行。
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
          <span class="section__eyebrow" translate="no">${eyebrow}</span>
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
    import { bodyToHtml } from '/js/shared/blog-content.js';
    const ARTICLE = JSON.parse(document.getElementById('article-data').textContent);
    function renderArticle(lang) {
      const d = ARTICLE[lang] || ARTICLE.ja;
      document.getElementById('article-title').textContent = d.title;
      document.getElementById('article-body').innerHTML = bodyToHtml(d.body, window);
      document.title = d.title + ' — ' + (lang === 'en' ? 'Senridoufuu Co., Ltd.' : '千里同風株式会社');
    }
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
