import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 为什么有这套断言 ────────────────────────────────────────────────────────
// 2026-08-28：作者手机上打开后台，顶栏按钮的文字被压成竖排、「退出」被切掉、
// 溢出的部分盖住下面的卡片。我先只修了 solutions/demo/admin.html —— 因为
// 那是我手头正在看的那一页。作者打开 AI 情报页一看，还是坏的。
//
// 根因不是某一页，是**同一个顶栏有两种实现、散在五个页面**，其中 .top-bar
// 的 CSS 还在三个页面里各内联了一份。修一页 ≠ 修好了。
// 现在统一到 css/admin-header.css，这套断言盯着两件事：
//   ① 有这种顶栏的页面，必须引入这份共享样式
//   ② link 必须排在页面自己的 <style> 之后 —— .top-bar 的基础样式写在内联
//      style 里，同为 0-1-0 优先级，靠"后来者胜"。位置放错会**静默失效**。

const SHARED = 'css/admin-header.css';

function htmlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'docs', 'tests'].includes(name)) continue;
    if (name.startsWith('__')) continue; // 渲染验证用的临时预览页
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const PAGES = htmlFiles(ROOT).map((p) => ({
  rel: path.relative(ROOT, p).replace(/\\/g, '/'),
  html: readFileSync(p, 'utf8'),
}));

/** 需要这份样式的页面：用 .top-bar 顶栏，或用 Tailwind h-14 的 <header>。 */
function needsShared(html) {
  if (/class="[^"]*\btop-bar\b[^"]*"/.test(html)) return true;
  return /<header[^>]*class="[^"]*\bh-14\b[^"]*"/.test(html);
}

// japanese_learner 的顶栏是**另一套结构**：header 下只有一个内层 div，换行和
// overflow 都写在那个 div 上。2026-08-28 在 390px 实测不塌（竖排 0、右端
// 378/390、内容不溢出），而硬套共享样式反而会给它的内容加上 nowrap + 省略号。
// ⚠️ 豁免本身必须被断言住：哪天它改成"左标题 + 右按钮组"的两栏结构，
//    这条豁免会静默放行一个真的会塌的页面。
const WAIVED = {
  'solutions/demo/japanese_learner.html': '单层结构，换行写在内层 div 上',
};

test('豁免的前提仍然成立：被豁免的页面确实自己处理了换行', () => {
  for (const [rel, why] of Object.entries(WAIVED)) {
    const page = PAGES.find((p) => p.rel === rel);
    assert.ok(page, `豁免名单里的 ${rel} 已经不存在了，请把它从名单里去掉`);
    const header = page.html.match(/<header[\s\S]*?<\/header>/);
    assert.ok(header, `${rel} 里找不到 <header>`);
    assert.match(
      header[0],
      /flex-wrap/,
      `${rel} 的顶栏不再自己处理换行了（豁免理由是「${why}」），应改为引入共享样式`,
    );
  }
});

const TARGETS = PAGES.filter((p) => needsShared(p.html) && !WAIVED[p.rel]);

test('护栏自身有效：真的扫到了带这种顶栏的页面', () => {
  assert.ok(PAGES.length >= 8, `只扫到 ${PAGES.length} 个 html`);
  assert.ok(
    TARGETS.length >= 5,
    `只认出 ${TARGETS.length} 个带后台顶栏的页面（应至少 5 个）：${TARGETS.map((t) => t.rel)}`,
  );
});

// ⚠️ 扫 CSS 前必须先剥注释。这套断言的头两版都被**我自己写在注释里的说明**
//    喂饱了：注释里有「光写 header 的 height:auto 压不过它」，于是把规则删掉
//    测试照样绿。同一个坑今天在 tool-tags 和 voice-backtranslation 上各踩过一次。
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('★ 共享样式文件必须存在，且真的包含防竖排的规则', () => {
  const css = stripCssComments(readFileSync(path.join(ROOT, SHARED), 'utf8'));
  // 按钮不许被压缩 —— 压不扁就不会出现竖排文字
  assert.match(css, /flex:\s*0\s+0\s+auto/, '缺少"按钮不可收缩"的规则');

  // 顶栏必须能换行、高度跟着内容走，**而且这两条要落在同一个规则块上**。
  // 只断言"文件里出现过 height:auto"太松：把基础块的 height 改回固定值、
  // 而别处仍有 auto，照样能过（突变验证当场抓到）。
  const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    sel: m[1].trim(),
    body: m[2],
  }));
  const base = blocks.filter((b) => /height:\s*auto/.test(b.body));
  assert.ok(
    base.length >= 1,
    '没有任何规则把顶栏的 height 设成 auto —— 换行的内容会溢出固定高的盒子',
  );
  for (const b of base) {
    assert.match(
      b.body,
      /flex-wrap:\s*wrap/,
      `设了 height:auto 的规则块没有同时允许换行：${b.sel}`,
    );
    // ⚠️ 选择器必须带类。Tailwind 的 .h-14 是**类**选择器，
    //    光写 header（标签选择器）压不过它，height:auto 会被静默忽略。
    assert.match(
      b.sel,
      /header\.h-14/,
      `顶栏基础规则的选择器是「${b.sel}」，没有 header.h-14 —— 会被 Tailwind 的 .h-14 压过去`,
    );
  }
});

test('★ 有这种顶栏的页面都要引入共享样式（修一页不等于修好了）', () => {
  const missing = TARGETS.filter((t) => !t.html.includes('admin-header.css')).map((t) => t.rel);
  assert.deepEqual(missing, [], `这些页面的顶栏在窄屏会塌：\n  ${missing.join('\n  ')}`);
});

test('★ link 必须排在页面自己的 <style> 之后，否则被内联样式压过去（静默失效）', () => {
  const bad = [];
  for (const t of TARGETS) {
    const link = t.html.indexOf('admin-header.css');
    if (link < 0) continue; // 上一条已经报过
    const lastStyle = t.html.lastIndexOf('</style>');
    if (lastStyle >= 0 && lastStyle > link) bad.push(t.rel);
  }
  assert.deepEqual(bad, [], `这些页面的 link 排在内联 <style> 之前：\n  ${bad.join('\n  ')}`);
});

test('★ 不许再把这套规则内联回某个页面 —— 散成多份就是这次事故的起因', () => {
  const dup = PAGES.filter((p) => /<style[\s\S]*header\.h-14[\s\S]*<\/style>/.test(p.html)).map(
    (p) => p.rel,
  );
  assert.deepEqual(dup, [], `这些页面又内联了一份顶栏规则：${dup.join(', ')}`);
});
