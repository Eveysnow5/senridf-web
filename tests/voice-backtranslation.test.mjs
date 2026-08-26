import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ⚠️ 扫源码的护栏，一律先剥注释再扫。
// 第一版没剥，于是「不许再出现 Translate naturally and fluently」这条，被我自己
// 写在源码注释里解释事故的那句原话给绊红了 —— 断言被自己的注释证伪。
function stripComments(src) {
  return src
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

const STREAM = stripComments(
  readFileSync(path.join(ROOT, 'functions', 'api', 'translate-stream.js'), 'utf8'),
);
const PAGE_RAW = readFileSync(path.join(ROOT, 'solutions', 'demo', 'translation.html'), 'utf8');
const PAGE = stripComments(PAGE_RAW);

// ── 背景 ────────────────────────────────────────────────────────────────────
// 2026-08-26 语音口译实测：Deepgram 中文听写四段错七处，而翻译层把坏输入
// 「修」成了流畅、笃定、看不出问题的假话 —— 编出原文没有的美元、把听错的
// 「党招」解成政治组织、把「负责人」升成「部長」、把三件独立的事合并成一句
// 并凭空造出从属关系。作者定的取舍：**信 > 达 > 雅**，编造是红线。

test('★ 同传提示词必须是"准确优先"，不是"通顺优先"', () => {
  assert.ok(
    !/naturally and fluently/i.test(STREAM),
    '"Translate naturally and fluently" 回来了 —— 那正是让模型把听错的输入修成假话的那句',
  );
  assert.match(STREAM, /ACCURACY OUTRANKS FLUENCY/, '缺少"信优先于达"的总纲');
  for (const [re, what] of [
    [/NEVER introduce an entity/i, '禁止引入原文没有的实体'],
    [/currency/i, '禁止凭空添货币（实测编出过「円・ドル」）'],
    [/job title|promote a title/i, '禁止升格职衔（实测把「负责人」升成「部長」）'],
    [/separate facts separate/i, '禁止把独立事实合并成暗示关联的一句'],
    [/political, legal, or personal/i, '禁止把听不清的片段解成政治/法律/人身指控'],
  ]) {
    assert.match(STREAM, re, `提示词里缺了：${what}`);
  }
});

// ── 回译必须是独立的一次调用 ────────────────────────────────────────────────
// 试过让主调用顺带输出【回訳】，两版都坏：
//   第一版把译文原样抄进回訳栏（两栏一字不差）；
//   第二版改用中文之后，它改抄输入原文。
// 两种都等于没有检查，而且更糟 —— 给假安心。
// 原因很简单：**原文就摆在它眼前，它没有理由真去回译。**
test('★ 主调用不许再顺带产出回译 —— 那条路试过两次，两次都变成抄写', () => {
  assert.ok(
    !/【回訳】/.test(STREAM),
    '提示词里又出现【回訳】了 —— 让同一次调用顺带回译，它只会抄译文或抄原文',
  );
  assert.match(
    STREAM,
    /Output ONLY the translation itself/,
    '主调用应该只输出译文（回译交给第二次调用）',
  );
});

test('★ 回译调用只能看到译文，绝不能看到原文', () => {
  const m = PAGE.match(/async function requestBackTranslation\([^)]*\)\s*\{[\s\S]*?\n {4}\}/);
  assert.ok(m, '找不到 requestBackTranslation —— 回译的独立调用没了');
  const fn = m[0];

  assert.match(fn, /requestTranslate\(\s*'\/api\/translate-stream'/, '回译没有走翻译接口');
  assert.match(
    fn,
    /content:\s*translated/,
    '回译喂进去的不是译文参数 —— 只要原文能进到这次调用里，它就会抄原文',
  );
  // ★ 关键：这个函数体里不能出现源文本。它的入参里根本没有 text/src，
  //   有的话说明有人把原文传进来了，回译就又能作弊了。
  for (const bad of ['text', 'src']) {
    assert.ok(
      !new RegExp(`content:\\s*${bad}\\b`).test(fn),
      `回译调用里出现了 content: ${bad} —— 原文进来了，它就会抄原文而不是真回译`,
    );
  }
  assert.match(fn, /direction:\s*`\$\{fromLang\}-\$\{toLang\}`/, '回译没有用反过来的方向');
});

test('★ 回译失败不许静默 —— 它是防编造的那道检查，静默失效等于检查没了', () => {
  const m = PAGE.match(/async function requestBackTranslation[\s\S]*?\n {4}\}/);
  assert.match(m[0], /catch \(err\)[\s\S]*console\.warn/, '回译的 catch 是静默的');
});

test('★ 口译不等回译 —— 不许 await，否则现场每句都要多等一次往返', () => {
  assert.ok(!/await\s+requestBackTranslation/.test(PAGE), 'await 了回译，口译会被拖慢一个来回');
  assert.match(PAGE, /\n\s*requestBackTranslation\(fullText,/, '主流程没有发起回译');
});

test('★ 朗读只念译文，导出/历史也不含回译', () => {
  assert.match(PAGE, /speakText\(fullText,\s*speakerLang\[tgtSpk\]\)/, '朗读没有念译文');
  assert.match(PAGE, /tgt:\s*fullText,/, '历史记录存的不是译文');
  // back 由回译回来后填，初始必须是空 —— 不能拿译文顶替
  assert.match(PAGE, /back:\s*'',/, 'back 字段初始值不是空串（可能被译文顶替了）');
});

test('回译有独立的展示位，且默认隐藏（没回来之前不占地方）', () => {
  assert.match(PAGE_RAW, /class="cue-back" hidden/, '缺少 .cue-back 展示位或它默认不是隐藏的');
  assert.match(PAGE_RAW, /\.cue-back\s*\{/, '缺少 .cue-back 的样式');
  // 排版要弱于译文，否则会跟正式译文抢注意力
  const css = PAGE_RAW.slice(
    PAGE_RAW.indexOf('.cue-back {'),
    PAGE_RAW.indexOf('.cue-back {') + 400,
  );
  assert.match(css, /font-size:\s*0\./, '回译的字号没有小于译文');
});
