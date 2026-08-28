import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(path.join(ROOT, 'solutions', 'demo.html'), 'utf8');
const CSS = readFileSync(path.join(ROOT, 'css', 'main.css'), 'utf8');

// ⚠️ 扫源码的护栏，负向断言一律先剥注释。
// 「不许出现 pushState」这条，被我自己写在文件头解释取舍的那句
// 「用 replaceState 不用 pushState」绊红了 —— 断言被自己的注释证伪。
// 同一个坑在 voice-backtranslation.test.mjs 上踩过一次（2026-08-26）。
function stripComments(src) {
  return src
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}
const FILTER = stripComments(readFileSync(path.join(ROOT, 'js', 'tool-filter.js'), 'utf8'));

// ── 背景 ────────────────────────────────────────────────────────────────────
// 2026-08-27：工具目录从 toB/toC 二分改成**功能标签**分类。一个工具可以同时
// 属于「音声認識」和「翻訳」，所以分类信息分散在两个地方：
//   ① <a data-tags="speech translate verify">  ← 筛选按这个走
//   ② 卡片里可见的 <span class="tool-card__tag">  ← 用户看到的是这个
// 这两处**会分家**：改了一处忘了另一处，页面看起来完全正常——卡片上写着
// 「音声認識」，可点那个标签它就消失了。这类不一致没有任何运行时报错。
// 下面的断言把它变成红灯。

/** 抓出工具卡（不含「開発中」那三张，它们不参与筛选）。 */
function toolCards() {
  const out = [];
  const re = /<a\s[^>]*class="tool-card"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of PAGE.matchAll(re)) {
    const open = m[0].slice(0, m[0].indexOf('>'));
    const tagAttr = open.match(/data-tags="([^"]*)"/);
    const tags = (tagAttr ? tagAttr[1] : '').split(/\s+/).filter(Boolean);
    const shown = [...m[1].matchAll(/class="tool-card__tag"\s+data-i18n="([^"]+)"/g)].map(
      (x) => x[1],
    );
    const nameAttr = m[1].match(/class="tool-card__name"\s+data-i18n="([^"]+)"/);
    const name = nameAttr ? nameAttr[1] : '?';
    out.push({ name, tags, shown, html: m[0] });
  }
  return out;
}

/** 筛选栏里的标签（去掉「すべて」那个空值）。 */
function chipTags() {
  return [...PAGE.matchAll(/class="tool-filter__chip[^"]*"\s+data-tag="([^"]*)"/g)]
    .map((m) => m[1])
    .filter(Boolean);
}

const CARDS = toolCards();
const CHIPS = chipTags();

test('护栏自身有效：真的抓到了卡片和标签，断言集合不为空', () => {
  assert.ok(CARDS.length >= 6, `只抓到 ${CARDS.length} 张工具卡`);
  assert.ok(CHIPS.length >= 5, `只抓到 ${CHIPS.length} 个筛选标签`);
  for (const c of CARDS) {
    assert.ok(c.tags.length >= 1, `${c.name} 没有 data-tags —— 它会被任何筛选隐藏掉`);
  }
});

test('★ 卡片上写着的标签，必须和筛选用的 data-tags 一一对应', () => {
  // 不一致的后果：卡片写着「音声認識」，点那个标签它却消失。
  const bad = [];
  for (const c of CARDS) {
    const fromData = c.tags.map((t) => `tag_${t}`).sort();
    const shown = [...c.shown].sort();
    if (fromData.join(',') !== shown.join(',')) {
      bad.push(`${c.name}: data-tags=[${fromData}] 但卡片上显示 [${shown}]`);
    }
  }
  assert.deepEqual(bad, [], `标签对不上：\n${bad.join('\n')}`);
});

test('★ 每个筛选标签至少有一个工具 —— 点下去空白页等于坏了', () => {
  const used = new Set(CARDS.flatMap((c) => c.tags));
  const dead = CHIPS.filter((t) => !used.has(t));
  assert.deepEqual(dead, [], `这些标签点了没有任何结果：${dead.join(', ')}`);
});

test('★ 卡片用的标签必须在筛选栏里有对应的按钮，否则那个分类没有入口', () => {
  const chips = new Set(CHIPS);
  const orphan = [...new Set(CARDS.flatMap((c) => c.tags))].filter((t) => !chips.has(t));
  assert.deepEqual(orphan, [], `这些标签没有筛选按钮：${orphan.join(', ')}`);
});

test('页面确实加载了筛选脚本，否则标签栏只是一排点不动的按钮', () => {
  assert.match(PAGE, /<script src="js\/tool-filter\.js"/, '没有引入 tool-filter.js');
  assert.match(PAGE, /data-tool-filter/, '缺少 data-tool-filter 容器');
  assert.match(PAGE, /data-tool-grid/, '缺少 data-tool-grid 容器');
});

test('★「開発中」的卡片不带 data-tags —— 它们没有入口，不该参与筛选', () => {
  const wip = [...PAGE.matchAll(/<div\s[^>]*class="tool-card tool-card--wip"[^>]*>/g)].map(
    (m) => m[0],
  );
  assert.ok(wip.length >= 3, `只找到 ${wip.length} 张開発中卡片`);
  for (const w of wip) {
    assert.ok(!/data-tags/.test(w), `開発中卡片带了 data-tags：${w}`);
  }
});

test('★ 筛选脚本必须给出就绪标记 —— 渲染验证要靠它，不能靠"元素出现了"', () => {
  // 第一版渲染探针等的是「卡片元素出现」，那时 CSS 还没应用、defer 脚本还没跑，
  // 于是量到 grid-template-columns: none，报出假的"布局坏了"。
  assert.match(FILTER, /data-filter-ready/, '没有就绪标记');
});

test('★ 再次点击同一个标签要能取消筛选，不然用户会被困在一个标签里', () => {
  assert.match(FILTER, /is-on'\)\s*\?\s*''\s*:/, '没有"再点一次回到全部"的分支');
});

// ── 2026-08-27 线上事故：chip 高亮了，卡片一张没少 ──────────────────────────
// tool-filter.js 设的是 card.hidden = true。浏览器内置的 [hidden] { display: none }
// 是**标签选择器**，优先级低于 .tool-card { display: flex } —— 属性设上了，
// 元素照样占位显示。筛选看起来完全失效，而 JS 没有任何报错。
//
// 更要命的是：当时的渲染夹具读的是 `c.hidden` 这个**属性**，属性确实是 true，
// 于是夹具全绿、我报了"筛选行为已实测"。**护栏测的是"标记设上了"，
// 不是"东西真的不见了"。** 作者打开线上一点就发现了。
test('★ .tool-card 必须有 [hidden] 的 display:none —— 否则 hidden 属性会被 display:flex 盖掉', () => {
  // 先确认前提仍成立：.tool-card 确实用类选择器设了 display
  assert.match(
    CSS,
    /\.tool-card \{[^}]*display:\s*flex/,
    '.tool-card 不再用 display:flex 了？那这条断言的前提要重新想',
  );
  assert.match(
    CSS,
    /\.tool-card\[hidden\][^{]*\{[^}]*display:\s*none/,
    '缺少 .tool-card[hidden] { display: none } —— 筛选会"看起来生效、其实没动"',
  );
});

test('★ 筛选靠的是 hidden 属性，所以这两件事必须成对存在', () => {
  // 哪天改成加 class 来隐藏，上面那条 CSS 断言就该跟着改；
  // 这条把"实现方式"钉住，免得 CSS 和 JS 各改各的、又对不上。
  assert.match(FILTER, /card\.hidden\s*=/, 'tool-filter.js 不再用 card.hidden 隐藏卡片了');
});

// ── 筛选是纯视觉变化，读屏软件不会自己播报 ───────────────────────────────────
// 没有状态行，用读屏的人点完标签得不到任何反馈：按钮"按下去了"，然后什么也没发生。
// 状态行刻意做成不可见（.sr-only）：作者的硬要求是六个工具一屏放得下，
// 多一行可见文字要吃掉二十几 px。
test('★ 筛选要有 aria-live 状态行，且不占版面', () => {
  assert.match(PAGE, /data-tool-status/, '缺少状态行容器');
  assert.match(PAGE, /aria-live="polite"/, '状态行没有 aria-live');
  assert.match(PAGE, /class="sr-only"[^>]*data-tool-status/, '状态行不是 .sr-only —— 会挤掉版面');
  assert.match(CSS, /\.sr-only\s*\{[^}]*clip-path/, '.sr-only 没有用 clip-path 的标准实现');
  // display:none / visibility:hidden 会把读屏软件一起挡掉，等于白写
  const at = CSS.indexOf('.sr-only {');
  const block = CSS.slice(at, CSS.indexOf('}', at));
  assert.ok(!/display:\s*none|visibility:\s*hidden/.test(block), '.sr-only 用了会屏蔽读屏的写法');
  assert.match(FILTER, /sdfSetText\([^)]*'tag_status'/, '状态行没有走 i18n —— 切语言时不会更新');
});

// ── 筛选状态要能分享 ────────────────────────────────────────────────────────
// 工具库的自然需求：「你看下语音相关的这几个」应该能直接发链接。
test('★ 筛选状态写进 URL，且只动 tag 这一个参数', () => {
  assert.match(FILTER, /searchParams\.set\('tag'/, '筛选没写进 URL');
  assert.match(FILTER, /searchParams\.delete\('tag'/, '取消筛选没把 tag 从 URL 去掉');
  // ⚠️ 上面两条只证明「函数体里写了」。突变验证当场发现：把调用点删掉、
  //    函数留着不调，这两条照样绿。**存在 ≠ 被调用**，所以要单独钉住调用点。
  assert.match(
    FILTER,
    /^\s*if \(!opts \|\| opts\.url !== false\) syncUrl\(tag\);/m,
    'syncUrl 定义了却没被调用 —— URL 不会变',
  );
  // ⚠️ 别写成 /replaceState/ 就完事：守卫行 `!window.history.replaceState` 里也有这个词，
  //    把调用改成 pushState 照样能过。突变验证当场抓到了这个逃脱（2026-08-27）。
  assert.match(FILTER, /history\.replaceState\(/, '不是在调用 replaceState');
  assert.ok(!/pushState/.test(FILTER), '用了 pushState —— 筛选会往浏览历史里塞一堆条目');
  // ?lang= 是站点自己的参数，绝不能被筛选顺手清掉
  assert.ok(
    !/location\.search\s*=/.test(FILTER) && !/new URLSearchParams\(\)/.test(FILTER),
    '整体重写了查询串 —— ?lang= 会被清掉',
  );
});

test('★ URL 里认不出的 tag 要倒回「全部」，不能给人一张空白页', () => {
  assert.match(FILTER, /KNOWN\.has\(wanted\)/, '没有校验 URL 传进来的 tag');
});
