import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 2026-08-17 那轮给这个页面做了 i18n，报的是「50 处界面文案三语化」。
// 08-19 复查发现：**只有静态 data-i18n 标记和一部分 sdfSetText 被覆盖了**，
// 用 innerHTML 模板字符串拼出来的 20 多处全漏了——键在 T 里躺着，
// 页面上照旧是硬编码中文。日语界面的实际样子是「外壳日文、运行中全中文」。
//
// 更麻烦的是它测不出来：tests/i18n-keys.test.mjs 只查「页面引用的键是否存在」，
// 反过来「页面该用键的地方用了没有」它管不着；而「T 里有没有死键」也查不出来
// ——因为同一句话往往一处走了 T、另一处又硬编码了一遍。
//
// 这条护栏从另一个方向堵：**脚本里不许再出现中文字符串字面量**，
// 例外必须显式登记在下面，写清楚为什么。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'solutions', 'demo', 'lifestory.html'), 'utf8');
const LINES = SRC.split('\n');

/** 题库是内容不是界面文案，三语各写各的，单独由 lifestory-bank.test.mjs 管。 */
function bankRange() {
  const start = LINES.findIndex((l) => l.includes('const ANCHORS = ['));
  const end = LINES.findIndex((l) => l.includes('const qText = '));
  assert.ok(start > 0 && end > start, '定位不到题库范围，护栏失效');
  return [start + 1, end + 1];
}

// 每一条豁免都要写明理由。只有这四类：
//   1. 语言切换按钮本身（日/中/EN 是各自语言的写法，不该被翻译）
//   2. LEGACY_CAT 的键（旧存档里存的就是这些中文，翻了迁移就失效）
//   3. data-i18n* 标记元素上的兜底文案（JS 跑之前显示，属于正常回落）
//   4. console 里给开发者看的话（不是界面文案）
const EXEMPT = [
  { test: (l) => /data-lang=|lang-btn/.test(l), why: '语言切换按钮' },
  { test: (l) => /data-i18n(-placeholder|-title)?=/.test(l), why: 'i18n 标记元素上的兜底文案' },
  { test: (l) => /console\.(warn|error|log)/.test(l), why: '开发者可见，不是界面文案' },
];

/** LEGACY_CAT 跨多行，键就是旧存档里存的那些中文，翻了迁移立刻失效。按范围豁免。 */
function legacyCatRange() {
  const start = LINES.findIndex((l) => l.includes('const LEGACY_CAT = {'));
  assert.ok(start > 0, '定位不到 LEGACY_CAT，护栏失效');
  const end = LINES.findIndex((l, i) => i > start && l.trim() === '};');
  assert.ok(end > start, 'LEGACY_CAT 没有找到结尾');
  return [start + 1, end + 1];
}

const CJK_LITERAL = /(['"`])((?:(?!\1).)*[一-鿿](?:(?!\1).)*)\1/g;

test('护栏自身有效：能定位题库、且文件确实很大', () => {
  const [a, b] = bankRange();
  assert.ok(b - a > 100, `题库范围只有 ${b - a} 行，定位可能错了`);
  assert.ok(LINES.length > 800, `文件只有 ${LINES.length} 行`);
});

test('护栏自身有效：正则认得出中文字符串字面量', () => {
  for (const s of ["x = '你好世界'", 'y = `提交失败`', 'z = "已保存"']) {
    assert.match(s, new RegExp(CJK_LITERAL.source), `认不出：${s}`);
  }
  assert.doesNotMatch("t('ls_saved')", new RegExp(CJK_LITERAL.source));
});

test('脚本里没有未登记的硬编码中文（漏一处就是那一处永远显示中文）', () => {
  const [bankStart, bankEnd] = bankRange();
  const [legacyStart, legacyEnd] = legacyCatRange();
  const bad = [];
  for (let i = 0; i < LINES.length; i++) {
    const n = i + 1;
    if (n >= bankStart && n <= bankEnd) continue;
    if (n >= legacyStart && n <= legacyEnd) continue;
    const line = LINES[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (EXEMPT.some((e) => e.test(line))) continue;
    for (const m of line.matchAll(CJK_LITERAL)) {
      if (m[2].trim().length >= 2) bad.push(`${n}: ${m[2].slice(0, 60)}`);
    }
  }
  assert.deepEqual(bad, [], `这些文案永远只会显示中文：\n${bad.join('\n')}`);
});

// 上一条只保证"没有中文字面量"。把 t('…') 换成英文硬编码同样能骗过它，
// 所以这里正面确认关键路径确实在走 T。
test('关键运行时文案确实走了 T，不是换成了别的硬编码', () => {
  for (const key of [
    'ls_loading_msg',
    'ls_loading_first',
    'ls_all_answered',
    'ls_restored',
    'ls_need_answer',
    'ls_submit_failed',
    'ls_gen_timeout',
    'ls_soft_landing',
    'ls_shared_n',
    'ls_sum_ready',
  ]) {
    assert.match(SRC, new RegExp(`t\\('${key}'\\)`), `${key} 没有在页面里被调用`);
  }
});
