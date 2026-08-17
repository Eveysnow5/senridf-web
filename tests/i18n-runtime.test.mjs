import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 行为测试：在 Node 里用极小的 DOM 桩跑 main.js 的 i18n 逻辑。
//
// 为什么不用截图：要验的是"**切语言之后**运行时写入的文案会不会跟着更新"，
// 而 headless 截图会在页面异步跑完之前就退出（--screenshot 截完即退，
// --dump-dom 在这台机器上输出为空）。观测手段本身不可靠时，绿灯没有意义。
// 这套桩直接回答那个问题，而且能永久留在 CI 里。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

/** 极小的元素桩：只实现 i18n 用到的那几样。 */
function makeEl(attrs = {}) {
  return {
    dataset: { ...attrs },
    textContent: '',
    _attrs: {},
    classList: { toggle() {} },
    setAttribute(k, v) {
      this._attrs[k] = v;
    },
    getAttribute(k) {
      return this._attrs[k];
    },
  };
}

/** 起一个沙箱，跑 main.js，返回 window 与登记的元素集合。 */
function boot(lang) {
  const els = [];
  const doc = {
    body: { dataset: {} },
    documentElement: {},
    addEventListener() {}, // 所有副作用都挂在 DOMContentLoaded 里，这里不触发
    getElementById: () => null,
    querySelectorAll(sel) {
      if (sel === '[data-i18n]') return els.filter((e) => e.dataset.i18n !== undefined);
      if (sel === '[data-i18n-placeholder]')
        return els.filter((e) => e.dataset.i18nPlaceholder !== undefined);
      if (sel === '[data-i18n-title]') return els.filter((e) => e.dataset.i18nTitle !== undefined);
      if (sel === '[data-lang]') return [];
      return [];
    },
  };
  const win = {
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  const sandbox = {
    window: win,
    document: doc,
    location: { search: lang ? `?lang=${lang}` : '' },
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
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'main.js' });
  return { win, els, doc };
}

test('护栏自身有效：main.js 能在桩上跑起来并暴露 i18n 入口', () => {
  const { win } = boot('ja');
  assert.equal(typeof win.sdfT, 'function');
  assert.equal(typeof win.sdfSetText, 'function');
  assert.equal(typeof win.sdfApplyI18n, 'function');
});

test('sdfT 按当前语言取值，缺键回落 ja 再回落 key 本身', () => {
  const ja = boot('ja').win;
  const en = boot('en').win;
  assert.equal(ja.sdfT('tl_tab_voice'), '音声通訳');
  assert.equal(en.sdfT('tl_tab_voice'), 'Live Interpretation');
  assert.equal(en.sdfT('__不存在的键__'), '__不存在的键__');
  assert.equal(en.sdfT('__不存在的键__', '兜底'), '兜底');
});

test('sdfSetText 写入译文，并把 key 记在 dataset 上', () => {
  const { win, els } = boot('ja');
  const el = makeEl();
  els.push(el);
  win.sdfSetText(el, 'tl_marker_selected');
  assert.equal(el.textContent, '選択中');
  assert.equal(el.dataset.i18n, 'tl_marker_selected');
});

test('计数类文案：{n} 被替换成真实数字', () => {
  const { win, els } = boot('ja');
  const el = makeEl();
  els.push(el);
  win.sdfSetText(el, 'tl_count_voice', 7);
  assert.equal(el.textContent, '7 件');
  assert.equal(el.dataset.i18nN, '7');
});

// ★ 这是本次改动的要害：运行时写入的文案必须能在切语言时跟着变。
// 直接 el.textContent = '…' 的老写法做不到——页面会停在半中半日的状态。
test('★ 切语言后，运行时写入的文案会被重新翻译', () => {
  const { win, els } = boot('ja');
  const el = makeEl();
  els.push(el);
  win.sdfSetText(el, 'tl_marker_selected');
  assert.equal(el.textContent, '選択中');

  // 模拟点语言按钮：main.js 的 switchLang 走的就是 applyTranslations
  const en = boot('en');
  en.els.push(el);
  en.win.sdfApplyI18n();
  assert.equal(el.textContent, 'Selected', '切到 en 之后没有重新翻译');
});

test('★ 切语言后计数不会丢——数字存在 dataset 上而不是拼死在文本里', () => {
  const { win, els } = boot('ja');
  const el = makeEl();
  els.push(el);
  win.sdfSetText(el, 'tl_count_exchange', 12);
  assert.equal(el.textContent, '12 件の翻訳');

  const zh = boot('zh');
  zh.els.push(el);
  zh.win.sdfApplyI18n();
  assert.equal(el.textContent, '12 条翻译', '切语言后计数丢了或没翻译');

  const en = boot('en');
  en.els.push(el);
  en.win.sdfApplyI18n();
  assert.equal(el.textContent, '12 translations');
});

test('placeholder 与 title 属性也会被翻译', () => {
  const { win, els } = boot('en');
  const input = makeEl({ i18nPlaceholder: 'tl_input_placeholder' });
  const btn = makeEl({ i18nTitle: 'tl_tts_title' });
  els.push(input, btn);
  win.sdfApplyI18n();
  assert.equal(input.getAttribute('placeholder'), 'Enter Chinese or Japanese…');
  assert.equal(btn.getAttribute('title'), 'Read aloud');
});

test('没有对应键的元素保持原样，不会被清空', () => {
  const { win, els } = boot('ja');
  const el = makeEl({ i18n: '__不存在的键__' });
  el.textContent = '原有文字';
  els.push(el);
  win.sdfApplyI18n();
  assert.equal(el.textContent, '原有文字');
});
