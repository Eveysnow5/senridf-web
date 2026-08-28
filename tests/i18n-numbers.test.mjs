import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

// ── 为什么有这套断言 ────────────────────────────────────────────────────────
// 2026-08-28：公司地址的英文版写着 "3-chome, Nishimikuni, Yodogawa-ku"，
// 而日中两版是「西三国4丁目4-9-7」。**丁目号不一样，番地整个丢了**，
// 从 2026-05-16 的初始提交起就这样，谁也没发现 —— 三种语言没人会同时读。
//
// 这类错的共同点：**数字在某个语种里悄悄少了**。人眼扫三栏文案不会去数数字，
// 机器一秒就能数完。

/** 括号配平切出语种块（和 i18n-keys.test.mjs 同一套办法，不靠缩进猜）。 */
function block(lang) {
  const start = MAIN.indexOf(`\n  ${lang}: {`);
  assert.ok(start > 0, `T 里找不到语种块 ${lang}`);
  let depth = 0;
  for (let i = MAIN.indexOf('{', start); i < MAIN.length; i++) {
    if (MAIN[i] === '{') depth++;
    else if (MAIN[i] === '}' && --depth === 0) return MAIN.slice(start, i);
  }
  throw new Error(`${lang} 块括号不配平`);
}

// ⚠️ 单引号和双引号都要认。只认单引号的话，英文里含撇号的那几条会被**静默漏掉**,
//    而"漏掉"和"没问题"在输出上分不出来。下面有键数断言兜着。
const VALUE = /^\s{4}([a-z][a-z0-9_]*):\s*\n?\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gm;
const NAME = /^\s{4}([a-z][a-z0-9_]*):/gm;

function parse(lang) {
  const body = block(lang);
  const out = new Map();
  for (const m of body.matchAll(VALUE)) out.set(m[1], m[2] ?? m[3]);
  const names = new Set([...body.matchAll(NAME)].map((m) => m[1]));
  return { out, names };
}

const LANGS = ['ja', 'zh', 'en'].map((l) => ({ lang: l, ...parse(l) }));

test('护栏自身有效：三个语种块都完整解析出了值', () => {
  for (const { lang, out, names } of LANGS) {
    const missed = [...names].filter((k) => !out.has(k));
    assert.deepEqual(missed, [], `${lang} 有 ${missed.length} 个键没解析出值，会被静默跳过`);
    assert.ok(out.size > 300, `${lang} 只解析出 ${out.size} 个键，护栏形同虚设`);
  }
});

const FULLWIDTH = {
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
};
/** 数字组。全角数字也算，否则日文里的「１０件」会被当成没有数字。 */
function digitGroups(s) {
  const norm = [...s].map((c) => FULLWIDTH[c] ?? c).join('');
  return norm.match(/\d+/g) ?? [];
}

// 判据故意选得保守：**某个语种有 3 组以上数字，另一个语种却只剩 0～1 组**。
// 三语的数字写法本来就不同（一、二、三 vs 1. 2. 3.；「3モード」vs "Three modes"），
// 逐一比对会淹没在噪声里。而"从 4 组掉到 1 组"不是写法差异，是**信息丢了**。
// 现有 368 个键里这条规则零误报，且能抓住地址那次事故。
const RICH = 3;
const POOR = 1;

test('★ 数字不许在某个语种里悄悄消失（地址、数量、上限这类事实）', () => {
  const bad = [];
  const [ja, zh, en] = LANGS;
  for (const key of ja.out.keys()) {
    const counts = LANGS.map(({ lang, out }) => ({
      lang,
      n: digitGroups(out.get(key) ?? '').length,
      text: out.get(key) ?? '',
    }));
    const max = Math.max(...counts.map((c) => c.n));
    const min = Math.min(...counts.map((c) => c.n));
    if (max >= RICH && min <= POOR) {
      bad.push(
        `${key}\n` +
          counts.map((c) => `      ${c.lang} ${c.n} 组: ${c.text.slice(0, 70)}`).join('\n'),
      );
    }
  }
  assert.deepEqual(bad, [], `这些键的数字在某个语种里丢了：\n${bad.join('\n')}`);
  void zh;
  void en;
});

test('★ 地址三语的数字必须完全一致 —— 写错的是公司自己的地址', () => {
  const [ja, zh, en] = LANGS.map(({ out }) => digitGroups(out.get('addr_street') ?? '').sort());
  assert.ok(ja.length >= 3, `日文地址只解析出 ${ja.length} 组数字，断言的前提没了`);
  assert.deepEqual(zh, ja, `中文地址数字和日文不一致：${zh} vs ${ja}`);
  assert.deepEqual(en, ja, `英文地址数字和日文不一致：${en} vs ${ja}`);
});
