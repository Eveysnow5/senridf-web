import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 月结页面是给日本人用的产品（2026-10-13）。当时查出来：页面 <html lang="zh-CN">、标题和脚本运行前的文字全是中文、
// 只加载简体中文字体（日文汉字显示成中文字形）、日文文案里混着中文的文件名和表名、写进工作文件夹的名字也是中文。
// 这些都不会报错——日文用户只会觉得「没做完」。这里把它们变成红灯。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8').replace(/\r\n/g, '\n');
const HTML = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing.html'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/** T.ja / T.zh / T.en 的键值（只取单行或折一行的字符串）。 */
function block(lang) {
  const a = MAIN.indexOf(`\n  ${lang}: {\n`);
  assert.ok(a > 0, `T 里找不到 ${lang}`);
  const next = { ja: '\n  zh: {\n', zh: '\n  en: {\n', en: null }[lang];
  const b = next ? MAIN.indexOf(next) : MAIN.length;
  const out = {};
  const re = /^ {4}(\w+):\s*(?:\n\s*)?(['"])((?:(?!\2)[^\\]|\\.)*)\2,/gm;
  for (const m of MAIN.slice(a, b).matchAll(re)) out[m[1]] = m[3].replace(/\\(['"])/g, '$1');
  return out;
}
const JA = block('ja');
const EN = block('en');
const ce = (t) => Object.entries(t).filter(([k]) => k.startsWith('ce_'));

// 只在中文里用的说法：文件名・文件夹名・中文表名・中文词。日文和英文的文案里不该出现
const ZH_ONLY = [
  '公司资料',
  '结账结果',
  '备份',
  '底稿',
  '汇总',
  '流水',
  '凭证',
  '银行账户',
  '银行规则',
  '员工',
  '标准报酬',
  '每月工资',
  '固定工资',
  '期初余额',
  '奖金',
  '开票',
  '固定资产',
  '折旧分摊',
  '调整分录',
  '劳动保险',
  '法人税调整',
  '中间纳付',
  '支给项目',
  '方针',
];

test('护栏自身有效：抽到了足量的月结文案', () => {
  assert.ok(ce(JA).length > 300, `T.ja 的 ce_ 只抽到 ${ce(JA).length} 条`);
  assert.ok(ce(EN).length > 300, `T.en 的 ce_ 只抽到 ${ce(EN).length} 条`);
});

test('日文・英文的月结文案里没有中文的文件名・表名・说法', () => {
  for (const [lang, t] of [
    ['ja', JA],
    ['en', EN],
  ]) {
    const bad = [];
    for (const [k, v] of ce(t))
      for (const w of ZH_ONLY) if (v.includes(w)) bad.push(`${lang}.${k}: ${w}`);
    assert.deepStrictEqual(bad, []);
  }
});

test('页面默认是日文：lang・标题・字体', () => {
  assert.match(HTML, /<html lang="ja">/);
  assert.ok(HTML.includes(`<title>${JA.ce_page_title}</title>`), '标题不是日文');
  assert.match(HTML, /family=[^"]*Noto\+Sans\+JP/, '没有加载日文字体');
  const body = /\n\s*body \{ font-family:([^}]+)\}/.exec(HTML);
  assert.ok(body, '找不到 body 的字体');
  // 默认（日文）的字体里不能有中文字体：有的话日文汉字会显示成中文字形
  assert.ok(!/Noto Sans SC|YaHei|PingFang/.test(body[1]), `默认字体里有中文字体：${body[1]}`);
  assert.match(
    HTML,
    /html:lang\(zh\) body \{ font-family:[^}]*Noto Sans SC/,
    '中文界面要换回中文字体',
  );
});

test('脚本运行前显示的文字是日文（和 T.ja 一致）', () => {
  const bad = [];
  let n = 0;
  for (const m of HTML.matchAll(/data-i18n="(\w+)"[^>]*>([^<]*)<\//g)) {
    const [, key, text] = m;
    if (!(key in JA)) continue;
    n++;
    const want = /[{<]/.test(JA[key]) ? '' : JA[key].replace(/&/g, '&amp;');
    if (text !== want && text !== JA[key]) bad.push(`${key}: 「${text}」≠「${want}」`);
  }
  assert.ok(n > 80, `只对上 ${n} 处`);
  assert.deepStrictEqual(bad, []);
});

test('工作文件夹里的名字跟着语言，日文界面不写中文名', () => {
  const m = /const NAMES = \{([\s\S]*?)\n {4}\};/.exec(HTML);
  assert.ok(m, '找不到 NAMES');
  const ja = /ja: \{([^}]*)\}/.exec(m[1]);
  assert.ok(ja, 'NAMES 里没有 ja');
  for (const w of ZH_ONLY) assert.ok(!ja[1].includes(w), `日文的名字里有「${w}」`);
  // 写文件的地方不再写死中文名
  const script = HTML.slice(HTML.indexOf('<script type="module">'));
  assert.ok(!/writeFile\(\[[^\]]*'(公司资料|结账结果|备份)/.test(script), '还有写死的中文路径');
  assert.ok(!/`底稿_\$\{lang\}/.test(script), '底稿的文件名还是写死的中文');
});
