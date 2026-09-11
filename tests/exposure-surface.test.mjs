import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 暴露面清单 —— 复盘③。
//
// ── 为什么有这条 ────────────────────────────────────────────────────────────
// 那个死孤儿 tools/document-analyzer 当初能潜伏在生产域名上（公网可达、加载漏洞库），
// 就是因为**没有任何东西在数"什么被暴露了、每个暴露是不是故意的"**。人工 grep 分类
// 又不可靠（第一版把 analysis/proofreader 误判成公开）。
//
// 做法：**声明式清单 + 测试校验**（同 corpus MANIFEST 那套）。下面 PAGES 里人工声明
// 每一页的分类，测试保证：
//   ① 每个 served 页都被声明了 —— **新加一个没声明的页（下一个孤儿）→ 红**
//   ② 声明里没有已删除的幽灵页
//   ③ 非公开页必须被 _headers 的 noindex 覆盖；公开页不得被 noindex（判据可靠，
//      复用第四包的 noindex 规则，不靠脆弱的"猜它有没有登录门"）
//   ④ 带 auth-gate 的工具页必须真的 import 了 auth-gate（那 4 个用 mountAuthGate 的）
//
// 清单本身就是给人看的「暴露面清单」，另有 docs/exposure-surface.md 的可读快照。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 分类：
//   public       公开内容页（可索引、进 sitemap）
//   gated-tool   登录后可用的工具，走共享 auth-gate（mountAuthGate）
//   special-tool 登录相关但门控方式特殊（不走 mountAuthGate），单独说明
//   admin        管理后台（自带登录表单 + isAdmin）
//   internal     内部工具（自带登录表单，非公开内容）
//   login        登录/账号页
//   iframe       被别的页 <iframe> 内嵌的组件，不独立作为入口
const PAGES = {
  'index.html': 'public',
  'about/index.html': 'public',
  'about/milestones.html': 'public',
  'solutions/index.html': 'public',
  'solutions/blog/index.html': 'public',
  'solutions/demo.html': 'public', // 工具目录（营销页），卡片上标「会員限定」但目录本身公开

  'account.html': 'login',
  'bids/index.html': 'internal', // 标题「千里同風 内部工具」，自带登录表单

  'admin/index.html': 'admin',
  'admin/blog/index.html': 'admin',
  'admin/macro.html': 'admin',
  'admin/macro-dashboard.html': 'iframe', // 被 admin/macro.html 内嵌；只显示公开宏观数据
  'solutions/demo/admin.html': 'admin', // 会员审核后台
  'solutions/demo/ai-intel.html': 'internal',

  'solutions/demo/analysis.html': 'gated-tool',
  'solutions/demo/lifestory.html': 'gated-tool',
  'solutions/demo/proofreader.html': 'gated-tool',
  'solutions/demo/translation.html': 'gated-tool',
  // ⚠️ 特殊：japanese_learner 不走 mountAuthGate，而是自己用 firebase auth + isAdmin
  //    只对管理员显示「真题演练」入口。它在 /solutions/demo/ 下、被 noindex 覆盖。
  'solutions/demo/japanese_learner.html': 'special-tool',
};

const PUBLIC_CLASSES = new Set(['public']);

function servedHtml() {
  return execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f && !f.startsWith('tests/') && !f.startsWith('__preview') && f !== '404.html');
}

// _headers 里所有 noindex 的路径前缀（去掉尾部 *）。
function noindexPrefixes() {
  const headers = readFileSync(path.join(ROOT, '_headers'), 'utf8');
  return [...headers.matchAll(/^(\/\S*)\n\s+X-Robots-Tag:\s*noindex/gim)].map((m) =>
    m[1].replace(/\*$/, ''),
  );
}

/** 页面文件路径 → 它在线上的服务路径（用于和 noindex 前缀比对）。 */
function servedPath(file) {
  if (file === 'index.html') return '/';
  let p = '/' + file;
  if (p.endsWith('/index.html')) return p.replace(/index\.html$/, ''); // 目录页
  return p.replace(/\.html$/, ''); // 无扩展名
}

test('★ 每个 served 页都在暴露面清单里（新孤儿会红）', () => {
  const served = servedHtml();
  const declared = new Set(Object.keys(PAGES));
  const missing = served.filter((f) => !declared.has(f));
  assert.deepEqual(
    missing,
    [],
    `这些页没在 tests/exposure-surface.test.mjs 的 PAGES 里声明分类：\n${missing.join('\n')}\n` +
      '每加一个对外页，都要在这里声明它的暴露级别（顺带想清楚它该不该被公网访问）。',
  );
});

test('清单里没有已删除的幽灵页', () => {
  const served = new Set(servedHtml());
  const ghosts = Object.keys(PAGES).filter((f) => !served.has(f));
  assert.deepEqual(ghosts, [], `清单里这些文件已不存在，删掉：\n${ghosts.join('\n')}`);
});

test('护栏自身有效：清单非空、noindex 规则解析到了', () => {
  assert.ok(Object.keys(PAGES).length >= 10, '清单太短，多半漏了');
  assert.ok(noindexPrefixes().length >= 3, 'noindex 规则没解析到');
});

test('★ 非公开页必须被 noindex 覆盖；公开页不得被 noindex', () => {
  const prefixes = noindexPrefixes();
  const covered = (p) => prefixes.some((pre) => p === pre || p.startsWith(pre));
  const wrong = [];
  for (const [file, cls] of Object.entries(PAGES)) {
    const p = servedPath(file);
    const isPublic = PUBLIC_CLASSES.has(cls);
    if (!isPublic && !covered(p))
      wrong.push(`${file} (${cls}) 不该被索引，但没被 noindex 覆盖：${p}`);
    if (isPublic && covered(p))
      wrong.push(`${file} (public) 被 noindex 覆盖了，公开内容不该被挡：${p}`);
  }
  assert.deepEqual(wrong, [], wrong.join('\n'));
});

test('★ gated-tool 必须真的接了共享 auth-gate（声明成有门就得真有门）', () => {
  const wrong = [];
  for (const [file, cls] of Object.entries(PAGES)) {
    if (cls !== 'gated-tool') continue;
    const html = readFileSync(path.join(ROOT, file), 'utf8');
    if (!/mountAuthGate|auth-gate\.js/.test(html)) {
      wrong.push(`${file} 声明为 gated-tool，但没 import auth-gate —— 门是假的`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join('\n'));
});

test('admin / internal / login / special-tool 页都带真实登录或鉴权代码（不是空壳门）', () => {
  const wrong = [];
  for (const [file, cls] of Object.entries(PAGES)) {
    if (!['admin', 'internal', 'login', 'special-tool'].includes(cls)) continue;
    const html = readFileSync(path.join(ROOT, file), 'utf8');
    // 这几类要么有登录表单，要么有 firebase 鉴权逻辑
    if (!/signInWithEmailAndPassword|onAuthStateChanged|firebase-init/.test(html)) {
      wrong.push(`${file} (${cls}) 里找不到任何登录/鉴权代码 —— 可能是没上锁的门`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join('\n'));
});

test('iframe 组件确实被别的页内嵌（不是独立入口）', () => {
  for (const [file, cls] of Object.entries(PAGES)) {
    if (cls !== 'iframe') continue;
    const base = path.basename(file);
    const refs = execSync(`git grep -l "${base}" -- "*.html" || true`, {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter((f) => f && f !== file);
    assert.ok(refs.length > 0, `${file} 声明为 iframe 组件，但没有任何页引用它 —— 可能是孤儿`);
  }
});
