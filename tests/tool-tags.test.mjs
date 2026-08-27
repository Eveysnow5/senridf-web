import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(path.join(ROOT, 'solutions', 'demo.html'), 'utf8');
const FILTER = readFileSync(path.join(ROOT, 'js', 'tool-filter.js'), 'utf8');
const CSS = readFileSync(path.join(ROOT, 'css', 'main.css'), 'utf8');

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
