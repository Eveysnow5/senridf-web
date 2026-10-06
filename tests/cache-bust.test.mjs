import { test } from 'node:test';
import assert from 'node:assert';
import { scan, ASSETS, htmlFiles } from '../scripts/qa/cache-bust.mjs';

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
