import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// i18n 的失败方式是**静默**的：键打错、或某个语种漏了一条，页面不会报错，
// 只会显示 HTML 里的兜底文案——而兜底文案通常是日文，于是英文用户看到日文，
// 一切"看起来正常"。这套测试把这两类静默失败变成红灯。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

/** 从 main.js 的 T 里抽出每个语种块的键名。用括号配平切块，不靠缩进猜。 */
function langKeys(lang) {
  const start = MAIN.indexOf(`\n  ${lang}: {`);
  assert.ok(start > 0, `T 里找不到语种块 ${lang}`);
  let i = MAIN.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < MAIN.length; i++) {
    if (MAIN[i] === '{') depth++;
    else if (MAIN[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.ok(end > 0, `${lang} 块括号不配平`);
  const body = MAIN.slice(start, end);
  return new Set([...body.matchAll(/^\s{4}([a-z][a-z0-9_]*):/gim)].map((m) => m[1]));
}

const ja = langKeys('ja');
const zh = langKeys('zh');
const en = langKeys('en');

test('护栏自身有效：三个语种块都抽到了足量键', () => {
  for (const [name, set] of [
    ['ja', ja],
    ['zh', zh],
    ['en', en],
  ]) {
    assert.ok(set.size > 50, `${name} 只抽到 ${set.size} 个键，护栏形同虚设`);
  }
});

test('三语键完全对齐——漏一条就是那个语种静默显示兜底文案', () => {
  const missingZh = [...ja].filter((k) => !zh.has(k));
  const missingEn = [...ja].filter((k) => !en.has(k));
  const extraZh = [...zh].filter((k) => !ja.has(k));
  const extraEn = [...en].filter((k) => !ja.has(k));
  assert.deepEqual(missingZh, [], `zh 缺少：${missingZh.join(', ')}`);
  assert.deepEqual(missingEn, [], `en 缺少：${missingEn.join(', ')}`);
  assert.deepEqual(extraZh, [], `zh 多出（ja 没有）：${extraZh.join(', ')}`);
  assert.deepEqual(extraEn, [], `en 多出（ja 没有）：${extraEn.join(', ')}`);
});

/** 递归收集仓库里的 html（跳过 node_modules 之类）。 */
function htmlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'docs') continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// account.html **自带一份 T**（登录/注册文案不走共享导航那套），所以它的键
// 不该拿共享 T 去校验。排除项本身要被断言住，否则哪天它改成用共享 T，
// 这个豁免会静默地让一整页失去检查。
const OWN_TABLE = new Set(['account.html']);
const PAGES = htmlFiles(ROOT);

test('排除项的前提仍然成立：account.html 确实自带 T', () => {
  const s = readFileSync(path.join(ROOT, 'account.html'), 'utf8');
  assert.match(s, /const T = \{/, 'account.html 不再自带 T，应把它并入共享校验');
});

test('护栏自身有效：扫到了页面', () => {
  assert.ok(PAGES.length >= 8, `只扫到 ${PAGES.length} 个 html`);
});

test('页面引用的 i18n 键都真实存在于 T（键打错 = 永远显示兜底文案）', () => {
  const bad = [];
  let scanned = 0;
  for (const p of PAGES) {
    if (OWN_TABLE.has(path.basename(p))) continue;
    scanned++;
    const html = readFileSync(p, 'utf8');
    const refs = [
      ...html.matchAll(/data-i18n(?:-placeholder|-title)?="([^"]+)"/g),
      ...html.matchAll(/data-page-title="([^"]+)"/g),
    ].map((m) => m[1]);
    for (const key of refs) {
      // `data-i18n="${cat.labelKey}"` 这类键是运行时算出来的，静态解析不了。
      // 跳过它们**不等于不管**——下面有一条专门断言 CATS 里那些键真实存在。
      if (key.includes('${')) continue;
      if (!ja.has(key)) bad.push(`${path.relative(ROOT, p)} → ${key}`);
    }
  }
  assert.ok(scanned >= 8, `只校验了 ${scanned} 个页面，排除项可能扩大到吃掉了整个检查`);
  assert.deepEqual(bad, [], `这些键在 T 里不存在：\n${bad.join('\n')}`);
});

// 2026-08-17 亲手踩的坑：给 lifestory/proofreader/japanese_learner 的登录门控加了
// data-i18n，但这三个页面**根本不加载 main.js**——属性是死的，只是把可见的兜底文案
// 从中文换成了日文，而这三个工具通篇是中文界面。
// "标记加上了"和"翻译真的会发生"是两回事，这条把它变成红灯。
test('用了 data-i18n 的页面必须加载 main.js，否则标记是死的', () => {
  const bad = [];
  for (const p of PAGES) {
    if (OWN_TABLE.has(path.basename(p))) continue;
    const html = readFileSync(p, 'utf8');
    const marked = /data-i18n(?:-placeholder|-title)?=|data-page-title=/.test(html);
    if (marked && !html.includes('js/main.js')) bad.push(path.relative(ROOT, p));
  }
  assert.deepEqual(
    bad,
    [],
    `这些页面带 i18n 标记却没加载 main.js（标记不会生效）：\n${bad.join('\n')}`,
  );
});

// data-i18n 会覆写 textContent，挂在有子元素的容器上会把子元素整个抹掉。
test('data-i18n 没有挂在含子元素的容器上', () => {
  const bad = [];
  for (const p of PAGES) {
    const html = readFileSync(p, 'utf8');
    for (const m of html.matchAll(/<(\w+)([^>]*\bdata-i18n="[^"]+"[^>]*)>([\s\S]*?)<\/\1>/g)) {
      if (/<\w/.test(m[3])) bad.push(`${path.relative(ROOT, p)}：<${m[1]} ${m[2].trim()}>`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    `这些元素带 data-i18n 却含子元素，翻译时子元素会被抹掉：\n${bad.join('\n')}`,
  );
});

// 上面那条对动态键（`${cat.labelKey}`）无能为力，这条补上：
// 校对工具的分类名走 CATS 里的 labelKey/shortKey，逐个确认它们真的在 T 里。
test('校对工具 CATS 里的 i18n 键都存在，且 keywords 仍是中文', () => {
  const src = readFileSync(path.join(ROOT, 'solutions', 'demo', 'proofreader.html'), 'utf8');
  const labelKeys = [...src.matchAll(/labelKey:\s*'([^']+)'/g)].map((m) => m[1]);
  const shortKeys = [...src.matchAll(/shortKey:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(labelKeys.length, 7, `labelKey 应有 7 个，实际 ${labelKeys.length}`);
  assert.equal(shortKeys.length, 7, `shortKey 应有 7 个，实际 ${shortKeys.length}`);
  for (const k of [...labelKeys, ...shortKeys]) assert.ok(ja.has(k), `T 里缺 ${k}`);

  // ⚠️ keywords 匹配的是**模型返回的中文报告**，与界面语言无关。
  // 一旦有人"顺手"把它翻成日文/英文，所有分类都会判成「未找到对应章节」——而且不报错。
  const keywords = [...src.matchAll(/keywords:\s*\['([^']+)'\]/g)].map((m) => m[1]);
  assert.equal(keywords.length, 7, `keywords 应有 7 个，实际 ${keywords.length}`);
  for (const kw of keywords) {
    assert.match(kw, /^[一二三四五六七]、[一-龥]+$/, `keywords 必须保持中文小节标题：${kw}`);
  }
});

test('分析工具与翻译工具的关键文案都已接入 i18n', () => {
  for (const key of [
    'an_title',
    'an_lead',
    'an_btn_submit',
    'an_prompt_placeholder',
    'an_page_title',
    'tl_title',
    'tl_lead',
    'ag_verifying',
  ]) {
    assert.ok(ja.has(key), `ja 缺 ${key}`);
  }
  const an = readFileSync(path.join(ROOT, 'solutions', 'demo', 'analysis.html'), 'utf8');
  assert.match(an, /data-page-title="an_page_title"/);
  assert.match(an, /data-i18n-placeholder="an_prompt_placeholder"/);
  // 迁到 Cloudflare 之后这条提示还写着 Netlify，属于用户看得见的过期文案。
  assert.doesNotMatch(an, /Netlify/i, 'analysis.html 里不该再提 Netlify');
});
