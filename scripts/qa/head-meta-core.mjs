// head-meta 的纯逻辑（无 fs / child_process），供两处共用（2026-10-22 拆出）：
//   - scripts/qa/head-meta.mjs：npm run meta / 测试，扫全站
//   - workers/sdf-admin（Cloudflare Worker，没有 Node 的 fs）：后台发布 blog 文章时给新页面生成同一块 head
// 以前 Worker 生成的文章页没有这块，上线检查必红、文章永远上不了线（10-21 实际发生）。
// 两边用同一个函数，Worker 写出来的就是 npm run meta 会写的，检查不会再分叉。

export const ORIGIN = 'https://www.senridf.com';

// 公开页面 → 规范网址（与 sitemap.xml 一致：目录以 / 结尾，其余不带 .html）。
// blog 文章不在这里登记：它们由 posts.json 决定（blogRoutes），后台发布时自动加入。
export const PUBLIC = {
  'index.html': '/',
  'about/index.html': '/about/',
  'about/company.html': '/about/company',
  'about/milestones.html': '/about/milestones',
  'solutions/index.html': '/solutions/',
  'solutions/demo.html': '/solutions/demo',
  'solutions/order-to-ledger.html': '/solutions/order-to-ledger',
  'solutions/blog/index.html': '/solutions/blog/',
  'privacy/index.html': '/privacy/',
  'contact.html': '/contact',
};

/** blog 文章的文件路径与规范网址（slug 来自 posts.json）。 */
export const blogArticleFile = (slug) => `solutions/blog/${slug}.html`;
export const blogArticleRoute = (slug) => `/solutions/blog/${slug}`;

/** posts.json 的数组 → { 文件: 网址 } */
export function blogRoutes(posts) {
  return Object.fromEntries(
    (Array.isArray(posts) ? posts : []).map((p) => [
      blogArticleFile(p.slug),
      blogArticleRoute(p.slug),
    ]),
  );
}

export const START = '<!-- head-meta:start（npm run meta 生成，勿手改） -->';
export const END = '<!-- head-meta:end -->';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function render(file, src, routes = PUBLIC) {
  const lines = [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  ];
  const route = routes[file];
  if (route) {
    const title = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || '千里同風株式会社';
    const desc = (src.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || '';
    const url = ORIGIN + route;
    lines.push(
      `<link rel="canonical" href="${url}">`,
      '<meta property="og:site_name" content="千里同風株式会社">',
      '<meta property="og:type" content="website">',
      '<meta property="og:locale" content="ja_JP">',
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:image" content="${ORIGIN}/og-image.png">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">',
    );
  }
  return `  ${START}\n${lines.map((l) => '  ' + l).join('\n')}\n  ${END}\n`;
}

// 去掉块外散落的旧标签（首页原有手写的 og:*），再把块放到 </head> 前。
export function apply(file, src, routes = PUBLIC) {
  let out = src.replace(
    new RegExp(`[ \\t]*${START.replace(/[.*+?^${}()|[\]\\（）]/g, '\\$&')}[\\s\\S]*?${END}\\n?`),
    '',
  );
  out = out
    .replace(/^[ \t]*<meta\s+property="og:[^"]*"[^>]*>\s*\n/gm, '')
    .replace(/^[ \t]*<meta\s+name="twitter:[^"]*"[^>]*>\s*\n/gm, '')
    .replace(/^[ \t]*<link\s+rel="(?:canonical|icon|apple-touch-icon)"[^>]*>\s*\n/gm, '');
  return out.replace(/([ \t]*)<\/head>/, (m) => render(file, out, routes) + m);
}
