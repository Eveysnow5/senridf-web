// 共用资源的缓存破坏：把各页面对 js/main.js、css/main.css 的引用改成 ?v=<内容指纹>。
//
// 为什么（2026-10-06）：这两个文件被浏览器缓存 4 小时（Cloudflare 区域的浏览器缓存 TTL，
// 在同事账号下，我们改不了），而 HTML 不缓存。于是新加的文案键先到了 HTML、没到 JS，
// 老访客看到的是 HTML 里写死的日文——中文页上出现中日混排（作者实机截图发现）。
// 手动加 ?v= 迟早会忘；按内容指纹自动写，文件一变网址就变，任何缓存都失效。
//
// 用法：node scripts/qa/cache-bust.mjs        —— 改写所有引用
//       node scripts/qa/cache-bust.mjs --check —— 只检查，不一致就退出码 1（测试也用同一逻辑）
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// 共用、且改动会影响页面行为/文案的本地资源。新增共用脚本时加进来。
export const ASSETS = [
  'js/main.js',
  'css/main.css',
  'js/tracking.js',
  'js/order-to-ledger-demo.js',
];

// 换行符先统一成 LF 再算：Windows 上 git 会按 autocrlf 把工作区转成 CRLF，仓库里是 LF。
// 直接按字节算的话，同一份内容换台机器 checkout 指纹就变，测试会误报。
export function fingerprint(rel) {
  const text = readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text).digest('hex').slice(0, 10);
}

export function htmlFiles() {
  return execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

// 引用的样子：src="js/main.js" / "../../js/main.js" / "/js/main.js" / 带或不带 ?v=xxx
function refRegex(asset) {
  const esc = asset.replace(/[.]/g, '\\.');
  return new RegExp(`((?:\\.\\./)*/?${esc})(\\?v=[A-Za-z0-9]+)?(?=["'])`, 'g');
}

export function scan({ write = false } = {}) {
  const want = Object.fromEntries(ASSETS.map((a) => [a, fingerprint(a)]));
  const stale = [];
  let refs = 0;
  for (const f of htmlFiles()) {
    const p = path.join(ROOT, f);
    const src = readFileSync(p, 'utf8');
    let out = src;
    for (const a of ASSETS) {
      out = out.replace(refRegex(a), (m, base, v) => {
        refs++;
        const good = `?v=${want[a]}`;
        if (v !== good) stale.push(`${f}: ${base}${v || ''}`);
        return base + good;
      });
    }
    if (write && out !== src) writeFileSync(p, out);
  }
  return { want, refs, stale };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const check = process.argv.includes('--check');
  const r = scan({ write: !check });
  if (check && r.stale.length) {
    console.error(
      `缓存版本号过期 ${r.stale.length} 处——运行 npm run bust：\n` + r.stale.join('\n'),
    );
    process.exit(1);
  }
  console.log(
    `${check ? '检查' : '已改写'}：${r.refs} 处引用，指纹 ${JSON.stringify(r.want)}${check ? '' : `，更新 ${r.stale.length} 处`}`,
  );
}
