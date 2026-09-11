import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// sitemap.xml 的三个失效方式，逐个钉：
//   ① 列了不存在的 URL（文件删了没同步）→ 搜索引擎抓到 404
//   ② 列了需登录/后台页 → 把内部页暴露给搜索，且和 _headers 的 noindex 自相矛盾
//   ③ 新加了公开页却忘了写进 sitemap（最常见的腐烂）→ 页面搜不到
// 判据必须**两个方向都测**：sitemap 里的都合法，且公开页都在 sitemap 里。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.senridf.com';

const sitemap = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const headers = readFileSync(path.join(ROOT, '_headers'), 'utf8');

/** 取出 sitemap 里所有 <loc>。 */
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/** 规范 URL → 对应的仓库文件路径。 */
function urlToFile(loc) {
  assert.ok(loc.startsWith(ORIGIN), `URL 不是本站：${loc}`);
  let p = loc.slice(ORIGIN.length); // e.g. "/about/milestones" or "/"
  if (p === '/') return 'index.html';
  p = p.replace(/^\//, '');
  if (p.endsWith('/')) return p + 'index.html'; // 目录页
  return p + '.html'; // 无扩展名子页
}

/** git 跟踪的文件集合（CI 上 docs/ 不在，但这些 html 都在主仓库）。 */
const tracked = new Set(
  execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n'),
);

// _headers 里所有 noindex 的路径前缀。
const noindexPrefixes = [...headers.matchAll(/^(\/\S*)\n\s+X-Robots-Tag:\s*noindex/gim)].map((m) =>
  m[1].replace(/\*$/, ''),
);

test('护栏自身有效：sitemap 非空、noindex 规则解析到了', () => {
  assert.ok(locs.length >= 4, `sitemap 只有 ${locs.length} 个 URL，多半解析坏了`);
  assert.ok(
    noindexPrefixes.length >= 3,
    `_headers 的 noindex 规则只解析出 ${noindexPrefixes.length} 条`,
  );
});

test('★ sitemap 里每个 URL 都对应真实的、被跟踪的文件', () => {
  for (const loc of locs) {
    const file = urlToFile(loc);
    assert.ok(tracked.has(file), `${loc} → ${file} 不存在或未被 git 跟踪`);
  }
});

test('★ sitemap 里的页面都不在 noindex 路径下（自相矛盾会让页面白列）', () => {
  for (const loc of locs) {
    const p = loc.slice(ORIGIN.length);
    for (const prefix of noindexPrefixes) {
      assert.ok(
        !p.startsWith(prefix),
        `${p} 落在 noindex 前缀 ${prefix} 下 —— 又列进 sitemap 又叫别收录，矛盾`,
      );
    }
  }
});

test('★ 新公开内容页不会漏加进 sitemap（防腐烂）', () => {
  // 明确登记的「非公开」排除规则。加了新的后台/工具目录就来这里补一条。
  const isExcluded = (f) =>
    f.startsWith('admin/') ||
    f.startsWith('solutions/demo/') || // 需登录的工具（注意 solutions/demo.html 不在此目录）
    f.startsWith('bids/') || // 内部工具（带登录表单）
    f.startsWith('tests/') ||
    f === 'account.html' || // 登录页
    f === '404.html' ||
    f.startsWith('__preview');

  const sitemapFiles = new Set(locs.map(urlToFile));
  const missing = [...tracked].filter((f) => !isExcluded(f) && !sitemapFiles.has(f));
  assert.deepEqual(
    missing,
    [],
    `这些公开页不在 sitemap 里（要么加进 sitemap.xml，要么在本测试的 isExcluded 里登记为非公开）：\n${missing.join('\n')}`,
  );
});

test('登录页 / 后台 / 内部工具确实被 noindex 覆盖（漏一个就会被收录）', () => {
  const mustNoindex = ['/admin/', '/solutions/demo/', '/bids/', '/account'];
  for (const p of mustNoindex) {
    assert.ok(
      noindexPrefixes.some((prefix) => p.startsWith(prefix) || prefix.startsWith(p)),
      `${p} 没有被任何 noindex 规则覆盖`,
    );
  }
});
