// 各页面 <head> 的「网站基本功」：图标、规范网址、分享卡片（OG / Twitter）。
//
// 为什么（2026-10-06 基本功体检）：favicon 404、所有页面都没有 og:image、子页面连 og:title
// 都没有——链接发到 LINE / Slack / X 只显示一行网址；也没有 canonical。手改 13 个页面一定会漏，
// 所以由脚本按下表生成，包在标记之间，可重复运行（npm run meta）。
// 分享卡片的标题和描述直接取各页现有的 <title> 和 meta description，不另写一份（避免两处不一致）。
//
// 生成逻辑在 head-meta-core.mjs（2026-10-22 拆出，后台发布 blog 文章的 Worker 也用它）。
// 公开页面＝PUBLIC 表 ＋ posts.json 里的每篇 blog 文章。
//
// 用法：node scripts/qa/head-meta.mjs          —— 改写
//       node scripts/qa/head-meta.mjs --check  —— 只检查（tests/head-meta.test.mjs 用同一逻辑）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, PUBLIC, apply, render, blogRoutes } from './head-meta-core.mjs';

export { ORIGIN, PUBLIC, apply, render };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function htmlFiles() {
  return execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !/^(tests|docs|node_modules)\//.test(f));
}

/** PUBLIC ＋ posts.json 里登记的 blog 文章。 */
export function publicRoutes() {
  const p = path.join(ROOT, 'solutions/blog/posts.json');
  const posts = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
  return { ...PUBLIC, ...blogRoutes(posts) };
}

export function scan({ write = false } = {}) {
  const routes = publicRoutes();
  const stale = [];
  for (const f of htmlFiles()) {
    const p = path.join(ROOT, f);
    const src = readFileSync(p, 'utf8');
    if (!/<\/head>/.test(src)) continue;
    const out = apply(f, src, routes);
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
