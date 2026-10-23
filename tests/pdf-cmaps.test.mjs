import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// 凡是浏览器里调 pdf.js getDocument 的文件，都必须带编码表（cMapUrl），且版本与 pdf.js 本体一致。
// 不带时字体不嵌入的日文 PDF **不报错、只是少字**：TKC 残高試算表 0 字（带上 1,160 字），
// 在受発注页上还会被误判成「扫描图片」而拒收（2026-10-23 在线上页面复现）。
// 10-12 只修了 closing.html，受発注页和文书分析页漏了 11 天——所以这里扫全站，不按文件名点名。

const PDFJS_VERSION_RE = /ajax\/libs\/pdf\.js\/([\d.]+)\/pdf\.min\.js/;
const CMAP_RE = /cMapUrl: 'https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@([\d.]+)\/cmaps\/'/;

const users = execFileSync('git', ['grep', '-l', 'getDocument(', '--', '*.html', '*.js', '*.mjs'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f && !f.startsWith('tests/') && !f.startsWith('scripts/'));

test('护栏自身有效：找到了调用 getDocument 的浏览器文件', () => {
  // 截至 2026-10-23：受発注、文书分析、月结三处
  assert.ok(users.length >= 3, `只找到 ${users.length} 个：${users.join(', ')}`);
});

// pdf.js 本体的版本：写在 HTML 里；受発注的 JS 是外置文件，版本看加载它的那个页面
const pageOf = { 'js/order-to-ledger-demo.js': 'solutions/order-to-ledger.html' };

for (const f of users) {
  test(`${f}：每处 getDocument 都带编码表，版本与 pdf.js 一致`, () => {
    const src = readFileSync(f, 'utf8');
    const calls = [...src.matchAll(/getDocument\(([^;]*?)\)\s*(?:\.|\n)/g)].map((m) => m[1]);
    assert.ok(calls.length >= 1, '没找到 getDocument 调用（正则失配？）');
    for (const c of calls)
      assert.match(c, /PDF_OPTS/, `getDocument(${c.slice(0, 80)}) 没带 PDF_OPTS`);
    const cmap = src.match(CMAP_RE);
    assert.ok(cmap, '没有 cMapUrl（或不是 jsDelivr 的 pdfjs-dist cmaps）');
    assert.match(src, /cMapPacked: true/);
    assert.match(src, /isEvalSupported: false/);
    const lib = readFileSync(pageOf[f] || f, 'utf8').match(PDFJS_VERSION_RE);
    assert.ok(lib, '找不到 pdf.js 本体的版本');
    assert.equal(cmap[1], lib[1], 'cMap 版本与 pdf.js 本体不一致');
  });
}
