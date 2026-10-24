// 共用资源的缓存破坏：把各页面对 js/main.js、css/main.css 的引用改成 ?v=<内容指纹>。
//
// 为什么（2026-10-06）：这两个文件被浏览器缓存 4 小时（Cloudflare 区域的浏览器缓存 TTL，
// 在同事账号下，我们改不了），而 HTML 不缓存。于是新加的文案键先到了 HTML、没到 JS，
// 老访客看到的是 HTML 里写死的日文——中文页上出现中日混排（作者实机截图发现）。
// 手动加 ?v= 迟早会忘；按内容指纹自动写，文件一变网址就变，任何缓存都失效。
//
// 2026-10-24 扩到 js/shared/ 下全部模块 + 模块之间的 import：
// blog-posts-model.js 当天改了 4 次而不在手写清单里，作者和 Yuki 的浏览器留着旧版，
// Blog 后台的整段 module 因「does not provide an export named 'previewDoc'」不执行——
// 只剩一个点了没反应的登录框。手写清单「新增共用脚本时加进来」没人记得，所以改成自动收录；
// 模块里 import 的文件也要带指纹，否则改了被引用的文件、引用它的模块网址不变，照样吃旧缓存。
// 依赖的指纹写进引用方，引用方内容随之改变 → 指纹沿依赖链一路往上传，反复改写直到不再变化。
//
// 资源清单和改写规则在 cache-bust-core.mjs（2026-10-22 拆出，后台发布 blog 的 Worker 也用）。
//
// 用法：node scripts/qa/cache-bust.mjs        —— 改写所有引用
//       node scripts/qa/cache-bust.mjs --check —— 只检查，不一致就退出码 1（测试也用同一逻辑）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS as CORE_ASSETS, applyFingerprints } from './cache-bust-core.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// js/shared/ 下的模块全部自动收录（子目录 kb/ 是服务端数据，不收）
const SHARED = readdirSync(path.join(ROOT, 'js', 'shared'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => `js/shared/${f}`);
export const ASSETS = [...new Set([...CORE_ASSETS, ...SHARED])];

const hash = (text) =>
  createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);

// 换行符先统一成 LF 再算：Windows 上 git 会按 autocrlf 把工作区转成 CRLF，仓库里是 LF。
// 直接按字节算的话，同一份内容换台机器 checkout 指纹就变，测试会误报。
export function fingerprint(rel) {
  return hash(readFileSync(path.join(ROOT, rel), 'utf8'));
}

export function htmlFiles() {
  return execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

// JS 模块里的 import 说明符：from '…' / import '…' / import('…')。注释行不改。
const SPEC = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"?]+)(\?v=[A-Za-z0-9]+)?\2/g;

/** 把 JS 文件 rel 里指向 want 中资源的 import 改成带指纹；相对路径按 rel 所在目录解析。 */
export function rewriteJsImports(rel, src, want) {
  const dir = path.posix.dirname(rel);
  const stale = [];
  let refs = 0;
  const out = src
    .split('\n')
    .map((line) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return line;
      return line.replace(SPEC, (m, kw, q, spec, v) => {
        let target;
        if (spec.startsWith('/')) target = spec.slice(1);
        else if (spec.startsWith('./') || spec.startsWith('../'))
          target = path.posix.normalize(path.posix.join(dir, spec));
        else return m;
        if (!want[target]) return m;
        refs++;
        const good = `?v=${want[target]}`;
        if (v !== good) stale.push(`${rel}: ${spec}${v || ''}`);
        return kw + q + spec + good + q;
      });
    })
    .join('\n');
  return { out, refs, stale };
}

export function scan({ write = false } = {}) {
  // 1) JS 模块：先在内存里反复改写，直到指纹不再变化（依赖的指纹沿 import 链往上传）
  const jsAssets = ASSETS.filter((a) => a.endsWith('.js'));
  const text = Object.fromEntries(ASSETS.map((a) => [a, readFileSync(path.join(ROOT, a), 'utf8')]));
  const original = { ...text };
  let want;
  for (let round = 0; ; round++) {
    if (round > 30) throw new Error('cache-bust：模块指纹不收敛（import 有环？）');
    want = Object.fromEntries(ASSETS.map((a) => [a, hash(text[a])]));
    let changed = false;
    for (const a of jsAssets) {
      const r = rewriteJsImports(a, text[a], want);
      if (r.out !== text[a]) {
        text[a] = r.out;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const stale = [];
  let refs = 0;
  for (const a of jsAssets) {
    // 和磁盘上的原文比：原文里每处过期的引用都算一处
    const r = rewriteJsImports(a, original[a], want);
    refs += r.refs;
    stale.push(...r.stale);
    if (write && text[a] !== original[a]) writeFileSync(path.join(ROOT, a), text[a]);
  }
  // 2) HTML 页面
  for (const f of htmlFiles()) {
    const p = path.join(ROOT, f);
    const src = readFileSync(p, 'utf8');
    const r = applyFingerprints(src, want);
    refs += r.refs;
    stale.push(...r.stale.map((s) => `${f}: ${s}`));
    if (write && r.out !== src) writeFileSync(p, r.out);
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
    `${check ? '检查' : '已改写'}：${r.refs} 处引用，${Object.keys(r.want).length} 个资源${check ? '' : `，更新 ${r.stale.length} 处`}`,
  );
}
