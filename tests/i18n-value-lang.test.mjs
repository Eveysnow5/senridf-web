import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 文案的「值」得是那种语言（2026-10-19）。
//
// i18n-keys.test.mjs 只查三语的**键**齐不齐。2026-10-10 一次「修 CI」把日文原句原样抄进了
// T.zh.auto_hero_subtitle，键对齐了、测试全绿，中文页却显示日文。护栏查的是「有没有」，
// 不是「对不对」。这里查值：
//   ① 中文值与日文值一字不差、且含假名 → 抄过去的
//   ② 英文值与日文或中文值一字不差、且含汉字/假名 → 抄过去的
//   ③ 中文值里假名占比过高 → 是日文
//   ④ 英文值里汉字/假名占比过高 → 不是英文
//   ⑤ 日文值里出现简体专用字 → 混进了中文
// 同时查 main.js 内置值和后台写进 content.json 的覆盖值（页面实际显示的是后者优先）。
// 故意保留的外语（日本的会计术语、软件名、示例原文）占比低，不会触发；真要例外，写进 ALLOW 并注明原因。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
const CONTENT = JSON.parse(readFileSync(path.join(ROOT, 'content.json'), 'utf8'));

function boot(lang) {
  const doc = {
    body: { dataset: {} },
    documentElement: {},
    addEventListener() {},
    getElementById: () => null,
    querySelectorAll: () => [],
  };
  const win = {
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  const sb = {
    window: win,
    document: doc,
    location: { search: `?lang=${lang}` },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: '' },
    console,
    setTimeout,
    URL,
    URLSearchParams,
    IntersectionObserver: function () {
      return { observe() {}, unobserve() {}, disconnect() {} };
    },
    fetch: () => Promise.reject(new Error('no network in test')),
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(SRC, sb, { filename: 'main.js' });
  return win;
}

function langKeys(lang) {
  const start = SRC.indexOf(`\n  ${lang}: {`);
  let i = SRC.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  return [...SRC.slice(start, end).matchAll(/^\s{4}([a-z][a-z0-9_]*):/gim)].map((m) => m[1]);
}

const KANA = /[ぁ-ゖァ-ヺ]/g; // 不含「・」(30FB)「ー」(30FC)：中文里也用
const HAN = /[一-鿿]/g;
const LATIN = /[A-Za-z]/g;
// 日文里不会出现的简体字（与日文新字体字形不同的常用字）。只收不会误伤的。
const SIMPLIFIED =
  /[们这说时发产务对实现动关个为题进应经过让还给认识资质网页总负责组织级师传统觉买卖钱银钟间问听读书车门长张东乐边头样种类单词语译选择设计库户帐账码视频图层报导观处运营员]/;
// 允许原样出现的专有名词（品牌、人名、语言名）
const PROPER = /千里同風|千里同风|株式会社|南\s?雪|謝\s?怡然|日本語|中文/g;

const count = (s, re) => (s.match(re) || []).length;

// 例外：键 → 原因。只在确实需要另一种文字时加。
const ALLOW = {
  // 同传工具的记录区本来就是日中对照，标题同时写两种语言
  tl_history_label: '日中对照的对话记录，标题故意写两种语言',
  // 示例订单图的替代文字：图里是日本公司的订单，公司名（サンプル商事）原样保留
  o2l_ex_img_alt: '示例图里的日本公司名原样保留',
};

const W = { ja: boot('ja'), zh: boot('zh'), en: boot('en') };
const keys = new Set([...langKeys('ja'), ...langKeys('zh'), ...langKeys('en')]);
for (const l of ['ja', 'zh', 'en']) Object.keys(CONTENT[l] || {}).forEach((k) => keys.add(k));
/** 页面实际显示的值：content.json 覆盖优先，其次 main.js 内置 */
const shown = (l, k) => {
  if (CONTENT[l] && typeof CONTENT[l][k] === 'string')
    return { v: CONTENT[l][k], src: 'content.json' };
  const v = W[l].sdfT(k, null);
  return v === null ? null : { v, src: 'main.js' };
};

function violations() {
  const out = [];
  for (const k of keys) {
    if (ALLOW[k]) continue;
    const ja = shown('ja', k);
    const zh = shown('zh', k);
    const en = shown('en', k);
    if (zh && ja && zh.v === ja.v && count(ja.v, KANA) > 0) {
      out.push(`① ${k}（${zh.src}）：中文值与日文一模一样 —— ${zh.v.slice(0, 40)}`);
    }
    if (en && /[ぁ-ヺ一-鿿]/.test(en.v.replace(PROPER, ''))) {
      if ((ja && en.v === ja.v) || (zh && en.v === zh.v)) {
        out.push(`② ${k}（${en.src}）：英文值与日/中文一模一样 —— ${en.v.slice(0, 40)}`);
      }
    }
    if (zh) {
      const kana = count(zh.v, KANA);
      const han = count(zh.v.replace(PROPER, ''), HAN);
      if (kana >= 4 && kana / (kana + han) > 0.3) {
        out.push(
          `③ ${k}（${zh.src}）：中文值里假名占 ${Math.round((kana / (kana + han)) * 100)}% —— ${zh.v.slice(0, 40)}`,
        );
      }
    }
    if (en) {
      const t = en.v.replace(PROPER, '');
      const cjk = count(t, KANA) + count(t, HAN);
      const lat = count(t, LATIN);
      if (cjk >= 2 && cjk / (cjk + lat) > 0.3) {
        out.push(
          `④ ${k}（${en.src}）：英文值里中日文字占 ${Math.round((cjk / (cjk + lat)) * 100)}% —— ${en.v.slice(0, 40)}`,
        );
      }
    }
    if (ja && SIMPLIFIED.test(ja.v.replace(PROPER, ''))) {
      out.push(
        `⑤ ${k}（${ja.src}）：日文值里有简体字「${ja.v.match(SIMPLIFIED)[0]}」—— ${ja.v.slice(0, 40)}`,
      );
    }
  }
  return out;
}

test('护栏自身有效：抽到了足量的键，content.json 也读到了', () => {
  assert.ok(keys.size > 500, `只抽到 ${keys.size} 个键`);
  assert.ok(Object.keys(CONTENT.zh || {}).length > 0);
});

test('护栏自身有效：把日文原句抄进中文、英文里留汉字，都会被抓到', () => {
  // 用真实的那次事故形状做种子（2026-10-10 auto_hero_subtitle）
  const ja = '毎日の手作業を AI に任せて、チームは本来の仕事に集中。';
  assert.ok(count(ja, KANA) >= 4);
  const kana = count(ja, KANA);
  const han = count(ja, HAN);
  assert.ok(kana / (kana + han) > 0.3, '那次事故的句子必须能被规则③抓到');
  assert.ok(SIMPLIFIED.test('会员中心'), '规则⑤要能认出「会员」');
  assert.ok(!SIMPLIFIED.test('会員センター・写真・数字・理由・番号'), '规则⑤不能误伤日文常用字');
});

test('★ 每种语言显示的文字确实是那种语言（不是从别的语言抄过来的）', () => {
  const v = violations();
  assert.deepEqual(v, [], `发现 ${v.length} 处：\n  ${v.join('\n  ')}`);
});

test('例外清单里的键都还存在（键删了例外要跟着删）', () => {
  for (const k of Object.keys(ALLOW)) assert.ok(keys.has(k), `ALLOW 里的 ${k} 已不存在`);
});
