import { test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, ASSETS, htmlFiles, rewriteJsImports } from '../scripts/qa/cache-bust.mjs';

// 改了 js/main.js 或 css/main.css 却没更新各页面的 ?v= → 老访客最多 4 小时拿到旧文件。
// 旧 main.js 里没有新文案键，页面就退回 HTML 里写死的日文＝中文/英文页中日混排
// （2026-10-06 沿革页实机发生）。这条测试让「忘了更新版本号」在提交前就红。
test('各页面对 main.js / main.css 的引用都带着当前内容的指纹', () => {
  const r = scan({ write: false });
  assert.deepEqual(r.stale, [], `版本号过期，请运行 npm run bust：\n${r.stale.join('\n')}`);
});

// 护栏自检：确实扫到了引用（扫描范围缩成 0 时上一条会假绿）。
test('护栏自身有效：扫到了足够多的页面引用', () => {
  const r = scan({ write: false });
  assert.ok(htmlFiles().length >= 10, 'HTML 文件列表异常');
  assert.ok(r.refs >= 20, `只扫到 ${r.refs} 处引用，扫描范围可能坏了`);
  for (const a of ASSETS) assert.match(r.want[a], /^[0-9a-f]{10}$/);
});

// 2026-10-24：blog-posts-model.js 不在手写清单里，改了 4 次网址都没变；作者和 Yuki 的浏览器留着旧版，
// Blog 后台整段 module 报「does not provide an export named 'previewDoc'」不执行，只剩点了没反应的登录框。
test('js/shared 下每个模块都自动纳入版本号，Blog 后台引用的模块都带指纹', () => {
  const shared = readdirSync(new URL('../js/shared/', import.meta.url)).filter((f) =>
    f.endsWith('.js'),
  );
  assert.ok(shared.length >= 20, '共享模块列表异常');
  for (const f of shared) assert.ok(ASSETS.includes(`js/shared/${f}`), `${f} 没纳入版本号`);
  const blog = readFileSync(new URL('../admin/blog/index.html', import.meta.url), 'utf8');
  for (const m of ['blog-posts-model', 'blog-tags', 'auth-errors', 'admins', 'firebase-init'])
    assert.match(blog, new RegExp(`/js/shared/${m}\\.js\\?v=[0-9a-f]{10}'`), `${m} 没带指纹`);
});

test('模块之间的 import 也带指纹；注释行和外部网址不动', () => {
  const want = { 'js/shared/a.js': 'aaaaaaaaaa', 'js/shared/b.js': 'bbbbbbbbbb' };
  const src = [
    "import { x } from './a.js';",
    "import { y } from '/js/shared/b.js?v=0000000000';",
    "// import { z } from './a.js';",
    "import { q } from 'https://cdn.example.com/a.js';",
    "const m = await import('./b.js');",
  ].join('\n');
  const r = rewriteJsImports('js/shared/c.js', src, want);
  assert.deepEqual(r.out.split('\n'), [
    "import { x } from './a.js?v=aaaaaaaaaa';",
    "import { y } from '/js/shared/b.js?v=bbbbbbbbbb';",
    "// import { z } from './a.js';",
    "import { q } from 'https://cdn.example.com/a.js';",
    "const m = await import('./b.js?v=bbbbbbbbbb');",
  ]);
  assert.equal(r.stale.length, 3);
});

// 服务端（Pages Functions / sdf-admin Worker）打包时也引用部分共享模块；那些模块里出现 ?v= 的 import，
// 打包器按文件路径找不到 → 构建失败。现在它们都没有 import，这条把「以后加了」挡在提交前。
test('服务端打包会用到的共享模块里没有带 ?v= 的 import', () => {
  const used = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.m?js$/.test(e.name))
        for (const m of readFileSync(p, 'utf8').matchAll(
          /from ['"](?:\.\.\/)+(js\/shared\/[^'"]+)['"]/g,
        ))
          used.add(m[1]);
    }
  };
  for (const d of ['functions', 'workers'])
    walk(fileURLToPath(new URL(`../${d}/`, import.meta.url)));
  assert.ok(used.has('js/shared/admins.js'), '没扫到服务端引用，扫描坏了');
  for (const f of used) {
    const s = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /from ['"][^'"]+\?v=/, `${f} 被服务端打包，不能有 ?v= 的 import`);
  }
});
