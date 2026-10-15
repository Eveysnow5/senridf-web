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

// 文は です・ます体（2026-10-13：弥生は全部です・ます、それに合わせる）。ボタンと見出しは「選ぶ」「締める」のままでよいので、
// 見るのは「。」を含む文章だけ：括弧の中の補足を除いて、文末がひらがなの用言（る・た・い・だ…）で敬体でないものを拾う。
function plainEnds(text) {
  const bad = [];
  if (!text.includes('。')) return bad;
  for (const seg of text.replace(/<[^>]+>/g, '').split(/。|\n/)) {
    const body = seg
      .replace(/（[^（）]*）/g, '')
      .replace(/[\s:：、,.…!！?？—→」』）)\]]+$/u, '')
      .replace(/\{\w+\}$/, '');
    if (!/[るうくすつぬむぶぐただい]$/.test(body)) continue;
    if (/(です|ます|ません|でした|ました|ください|でしょう|ましょう)$/.test(body)) continue;
    if (/(はい|いいえ|なし|ない場合|支払い|扱い|違い|お知らせ|ほか|以外)$/.test(body)) continue;
    bad.push(body.slice(-20));
  }
  return bad;
}

test('日文的句子是です・ます体', () => {
  assert.deepStrictEqual(plainEnds('表を直して締め直す。理由を書いてください。'), [
    '表を直して締め直す',
  ]);
  assert.deepStrictEqual(plainEnds('明細がありません（まだ入れていない）。入れてください。'), []);
  const bad = [];
  for (const [k, v] of ce(JA)) for (const b of plainEnds(v)) bad.push(`${k}: …${b}`);
  assert.deepStrictEqual(bad, []);
});

// 银行规则试跑（2026-10-13）：面板用到的文案键三种语言都要有；结账前・结账后两处都要接上
test('规则试跑：文案三语齐全，资料检查和结账结果都会更新面板', () => {
  const used = [...new Set([...HTML.matchAll(/'(ce_rp_\w+)'/g)].map((m) => m[1]))];
  used.push('ce_rp_title');
  assert.ok(used.length >= 12, `只找到 ${used.length} 个键`);
  const ZH = block('zh');
  for (const k of used)
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /renderRules\(r\.rules_preview, /, '资料检查之后没有更新面板');
  assert.match(
    HTML,
    /if \(!isSample && r\.rules_preview\) renderRules\(r\.rules_preview\)/,
    '结账之后没有更新面板',
  );
});

// 外币单据（2026-10-13）：引擎认出外币单据（fields.currency）时，页面要用界面语言说明并要日元金额——
// 金额栏是外币的话不能悄悄留空也不能当日元。四种说法三语都要有
test('外币单据的草稿：四种提示三语齐全，页面按 fields.currency 显示', () => {
  const keys = ['ce_ev_fx_ask', 'ce_ev_fx_rounded', 'ce_ev_fx_used', 'ce_ev_fx_unread'];
  const ZH = block('zh');
  for (const k of keys) {
    assert.ok(HTML.includes(`'${k}'`), `页面没有用到 ${k}`);
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  }
  assert.match(HTML, /e\.status === '下書き' && e\.fields && e\.fields\.currency/);
});

// 2026-10-13：弥生导入文件・回答前的分录预览・定位的表述
test('弥生导入文件按字节写出；分录预览走引擎；定位表述三语齐全', () => {
  const ZH = block('zh');
  const keys = [
    ...['title', 'body', 'a', 'b', 'c', 'tail'].map((k) => `ce_stance_${k}`),
    'ce_yayoi_note',
    'ce_yayoi_open_note',
    ...['title', 'debit', 'credit', 'wait'].map((k) => `ce_pv_${k}`),
  ];
  for (const k of keys)
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  // 弥生的文件是 Shift_JIS 的字节：不能当文字用 TextEncoder 再编码（那样写出来是 UTF-8，弥生读不了）
  assert.match(HTML, /writeFile\(\[outDir\(\), p\.month, x\.name\], reportBytes\(x\)\)/);
  assert.match(HTML, /if \(!x\.b64\) return new TextEncoder\(\)\.encode\(x\.html\)/);
  // 期初余额的文件只在开始记账的月份有：说明跟着它出现
  assert.match(
    HTML,
    /'ce-yayoi-open-note'\)\.classList\.toggle\('hidden', !\(r\.exports && r\.exports\.yayoi_opening\)\)/,
  );
  // 预览由引擎算（和结账同一套函数），页面不自己拆税
  assert.match(HTML, /op: 'preview', args: \[x\.key, a\]/);
  const worker = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing-worker.js'), 'utf8');
  assert.match(worker, /EVIDENCE_OPS = new Set\(\[[^\]]*'preview'/);
});

// 2026-10-14：弥生会計的期初余额数据也能放进来（和导出是同一个格式）
test('弥生的期初余额数据：页面交给引擎写进工作簿，九种提示三语齐全', () => {
  const ZH = block('zh');
  const keys = [
    'ok',
    'retained',
    'names',
    'no_book',
    'exists',
    'start',
    'file',
    'book',
    'yaml',
  ].map((k) => `ce_z_op_${k}`);
  for (const k of keys)
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /evAsk\('import_opening', \[`_inbox\/\$\{name\}`\]/);
  // 换工作簿之前先备份旧的
  assert.match(
    HTML,
    /await writeFile\(bk, old\.buf\);\s+await writeFile\(\[old\.path\], reportBytes\(\{ b64: o\.book \}\)\)/,
  );
  const worker = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing-worker.js'), 'utf8');
  assert.match(worker, /EVIDENCE_OPS = new Set\(\[[^\]]*'import_opening'/);
});

// 2026-10-14：年度确定（确定后不再改动，错误在当年做更正分录）
test('年度确定：文案三语齐全，页面把引擎给的确定文件写进文件夹', () => {
  const ZH = block('zh');
  const keys = [
    'h',
    'd',
    'by',
    'go',
    'ok',
    'err_open',
    'err_checks',
    'err_not_closed',
    'err_already',
    'err_by',
    'err_other',
    'closed',
    'item',
  ].map((k) => `ce_cy_${k}`);
  for (const k of keys)
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /ask\(\{ cmd: 'finalize', fy_end: cyMonth, by, at: today\(\) \}\)/);
  assert.match(HTML, /await writeFile\(r\.path\.split\('\/'\), bytes\)/);
  const worker = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing-worker.js'), 'utf8');
  assert.match(worker, /jpclose\.web\.finalize_year\(ce_args\[0\], ce_args\[1\], ce_args\[2\]\)/);
});

// 2026-10-14：决算整理（第 13 期）在损益表里单独一栏
test('决算整理：损益表多一栏，文案三语齐全', () => {
  const ZH = block('zh');
  for (const k of ['ce_pl_settle', 'ce_pl_settle_note'])
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /const cols = \(m, x, y\) => \(st \? \[m, x, y\] : \[m, y\]\);/);
  assert.match(HTML, /cols\(v\.pl\.net_month, v\.pl\.net_settle, v\.pl\.net_ytd\)/);
});

// 2026-10-14：弥生的分录 → 银行规则的候选（勾选后写进公司资料）
test('弥生分录：候选面板三语齐全，写入走引擎、先备份工作簿', () => {
  const ZH = block('zh');
  const keys = [
    'h',
    'sum',
    'd',
    'inn',
    'out',
    'n',
    'none',
    'split_h',
    'unknown_h',
    'unknown_mark',
    'by',
    'go',
    'ok',
    'err_by',
    'err_empty',
    'err_no_bank',
    'err_no_book',
    'err_file',
  ].map((k) => `ce_lr_${k}`);
  for (const k of keys)
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /evAsk\('import_journal', \[`_inbox\/\$\{name\}`\]/);
  assert.match(HTML, /evAsk\('add_rules', \[pick, by, today\(\)\]\)/);
  assert.match(
    HTML,
    /await writeFile\(bk, old\.buf\);\s+await writeFile\(\[old\.path\], reportBytes\(\{ b64: a\.book \}\)\)/,
  );
  const worker = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing-worker.js'), 'utf8');
  assert.match(worker, /'import_journal',\s+'add_rules'/);
});

// 2026-10-14：客户列表（记住打开过的文件夹）
test('客户列表：文案三语齐全；只存句柄和摘要；同一文件夹按 isSameEntry 只记一条', () => {
  const ZH = block('zh');
  for (const k of ['h', 'item', 'never', 'open', 'forget', 'denied', 'gone', 'd'].map(
    (x) => `ce_cl_${x}`,
  ))
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /indexedDB\.open\('ce-clients', 1\)/);
  assert.match(HTML, /c\.handle\.isSameEntry\(dirHandle\)/);
  assert.match(HTML, /c\.handle\.requestPermission\(\{ mode: 'readwrite' \}\)/);
});

// 2026-10-14：跨年度查分录
test('查分录：文案三语齐全，查询交给引擎（closed/ 和上一次结账）', () => {
  const ZH = block('zh');
  const keys = [
    'h',
    'd',
    'acc',
    'sub',
    'text',
    'from',
    'to',
    'amount',
    'go',
    'count',
    'none',
    'closed',
    'date',
    'vno',
    'narr',
    'line',
    'dr',
    'cr',
    'bal',
    'err',
  ].map((k) => `ce_sr_${k}`);
  for (const k of keys)
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(
    HTML,
    /ask\(\{ cmd: 'search', args: \[v\('acc'\), v\('sub'\), v\('text'\), v\('from'\), v\('to'\), amount\] \}\)/,
  );
  const worker = readFileSync(path.join(ROOT, 'solutions', 'demo', 'closing-worker.js'), 'utf8');
  assert.match(worker, /jpclose\.web\.search\(\*ce_args\)/);
});

// 2026-10-15：证凭一个文件一条草稿；扫描只识别第 1 页、可以关掉；年报底稿给出说明
test('证凭：一个文件读完再交给引擎；扫描只识别第 1 页；读取文字可关；底稿有说明', () => {
  const ZH = block('zh');
  for (const k of [
    'ce_ev_ocr',
    'ce_ev_ocr_d',
    'ce_ev_pages',
    'ce_ev_skipped',
    'ce_ev_done_noocr',
    'ce_z_workpaper',
  ])
    for (const [lang, t] of Object.entries({ ja: JA, zh: ZH, en: EN }))
      assert.ok(k in t, `${lang} 缺 ${k}`);
  assert.match(HTML, /evAsk\('add', \[rel, sha, kind, today\(\), read, basis, total\]\)/);
  assert.match(HTML, /if \(!ocr \|\| scanned\+\+ >= 1\)/);
  assert.match(HTML, /r\.kind === 'workpaper'/);
});
