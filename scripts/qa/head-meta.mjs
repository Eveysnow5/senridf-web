// 各页面 <head> 的「网站基本功」：图标、规范网址、分享卡片（OG / Twitter）。
//
// 为什么（2026-10-06 基本功体检）：favicon 404、所有页面都没有 og:image、子页面连 og:title
// 都没有——链接发到 LINE / Slack / X 只显示一行网址；也没有 canonical。手改 13 个页面一定会漏，
// 所以由脚本按下表生成，包在标记之间，可重复运行（npm run meta）。
// 分享卡片的标题和描述直接取各页现有的 <title> 和 meta description，不另写一份（避免两处不一致）。
//
// 用法：node scripts/qa/head-meta.mjs          —— 改写
//       node scripts/qa/head-meta.mjs --check  —— 只检查（tests/head-meta.test.mjs 用同一逻辑）
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ORIGIN = 'https://www.senridf.com';

// 公开页面 → 规范网址（与 sitemap.xml 一致：目录以 / 结尾，其余不带 .html）
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

const START = '<!-- head-meta:start（npm run meta 生成，勿手改） -->';
const END = '<!-- head-meta:end -->';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function htmlFiles() {
  return execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !/^(tests|docs|node_modules)\//.test(f));
}

export function render(file, src) {
  const lines = [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  ];
  const route = PUBLIC[file];
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
export function apply(file, src) {
  let out = src.replace(
    new RegExp(`[ \\t]*${START.replace(/[.*+?^${}()|[\]\\（）]/g, '\\$&')}[\\s\\S]*?${END}\\n?`),
    '',
  );
  out = out
    .replace(/^[ \t]*<meta\s+property="og:[^"]*"[^>]*>\s*\n/gm, '')
    .replace(/^[ \t]*<meta\s+name="twitter:[^"]*"[^>]*>\s*\n/gm, '')
    .replace(/^[ \t]*<link\s+rel="(?:canonical|icon|apple-touch-icon)"[^>]*>\s*\n/gm, '');
  return out.replace(/([ \t]*)<\/head>/, (m) => render(file, out) + m);
}

export function scan({ write = false } = {}) {
  const stale = [];
  for (const f of htmlFiles()) {
    const p = path.join(ROOT, f);
    const src = readFileSync(p, 'utf8');
    if (!/<\/head>/.test(src)) continue;
    const out = apply(f, src);
    if (out !== src) {
      stale.push(f);
      if (write) writeFileSync(p, out);
    }
  }
  return stale;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const check = process.argv.includes('--check');
  const stale = scan({ write: !check });
  if (check && stale.length) {
    console.error(`head 信息过期 ${stale.length} 个页面——运行 npm run meta：\n` + stale.join('\n'));
    process.exit(1);
  }
  console.log(`${check ? '检查通过' : '已改写'}：${stale.length} 个页面${check ? '' : '有变化'}`);
}
