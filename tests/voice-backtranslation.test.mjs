import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ⚠️ 扫描前必须剥掉注释。
// 第一版没剥，于是「不许再出现 Translate naturally and fluently」这条，
// **被我自己写在源码注释里解释事故的那句原话**给绊红了 —— 断言被自己的注释
// 满足（这次是反向的：被自己的注释证伪）。同类毛病当天出现了八次。
// 规矩：扫源码的护栏，一律先剥注释再扫。
function stripComments(src) {
  return src
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

const STREAM = stripComments(
  readFileSync(path.join(ROOT, 'functions', 'api', 'translate-stream.js'), 'utf8'),
);
const PAGE = readFileSync(path.join(ROOT, 'solutions', 'demo', 'translation.html'), 'utf8');

// 2026-08-26 语音口译实测：Deepgram 中文听写四段错七处，而翻译层把坏输入
// 「修」成了流畅、笃定、看不出问题的假话 —— 编出原文没有的美元、把听错的
// 「党招」解成政治组织、把「负责人」升格成「部長」、把三件独立的事合并成
// 一句并凭空造出从属关系。
//
// 根子就在同传提示词里：它写着「通顺自然地翻译」（达优先）和「只输出译文」
// （于是没有回译）。作者定的取舍是 **信 > 达 > 雅**，编造是红线。

test('★ 同传提示词不能再是"通顺优先"', () => {
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

test('★ 同传必须输出【回訳】—— 那是听众发现"听错了"的唯一手段', () => {
  assert.ok(
    !/Output ONLY the translation/i.test(STREAM),
    '"Output ONLY the translation" 回来了 —— 它会把回译禁掉',
  );
  assert.match(STREAM, /【回訳】/, '提示词没有要求回译');
  assert.match(
    STREAM,
    /back-translation of YOUR OWN translation/i,
    '必须说明回译的是**模型自己的译文**，否则它会回译成"说话人大概想说的"，反而把错处盖住',
  );
  // 回訳 让输出大致翻倍，token 上限得跟上，否则回译会被截断
  const m = STREAM.match(/max_tokens:\s*(\d+)/);
  assert.ok(m, '找不到 max_tokens');
  assert.ok(Number(m[1]) >= 700, `max_tokens=${m[1]}，加了回訳之后不够，回译会被截断`);
});

test('★ 朗读只念译文，绝不念回訳', () => {
  assert.ok(
    !/speakText\(fullText/.test(PAGE),
    '朗读用的是整段流（含回訳）—— 在会议现场会把回译一起念出来',
  );
  assert.match(PAGE, /speakText\(\s*finalPart\.tl/, '朗读没有取拆分后的译文');
});

test('★ 导出/历史存的是译文，不含回訳', () => {
  assert.ok(!/tgt:\s*fullText/.test(PAGE), '历史记录存了整段流，导出的会议记录里会混进回译');
  assert.match(PAGE, /tgt:\s*finalPart\.tl/, '历史记录没有取拆分后的译文');
});

// splitBack 边流边拆，标记可能正好被切在两个数据块之间。
// 这段逻辑内联在 HTML 里没法 import —— 把它抠出来，在同样的输入上真的跑一遍。
function loadSplitBack() {
  const m = PAGE.match(/const BACK_MARK = '【回訳】';[\s\S]*?\n {4}}\n/);
  assert.ok(m, '找不到 splitBack 的实现 —— 它被改名或挪走了，这条测试要跟着改');
  return new Function(`${m[0]}; return splitBack;`)();
}

test('★ splitBack：标记被切在两个流块之间时，译文末尾不能闪出半个标记', () => {
  const splitBack = loadSplitBack();

  assert.deepEqual(splitBack('こんにちは'), { tl: 'こんにちは', back: '' }, '还没到标记');
  assert.deepEqual(
    splitBack('こんにちは【回訳】你好'),
    { tl: 'こんにちは', back: '你好' },
    '完整标记要拆开',
  );

  // 逐字符喂进去模拟流式：任何一步都不许把标记的碎片留在译文里。
  // 现场看到译文末尾闪出「【回」，跟出故障没有区别。
  const full = 'こんにちは【回訳】你好';
  for (let i = 1; i <= full.length; i++) {
    const { tl } = splitBack(full.slice(0, i));
    assert.ok(!tl.includes('【'), `喂到第 ${i} 个字符时译文里出现了「【」："${tl}"`);
    assert.ok(!/回$|回訳$/.test(tl), `喂到第 ${i} 个字符时译文末尾挂着标记碎片："${tl}"`);
  }

  // 反向对照：正文里本来就有的「【」不该被吞掉，否则"一律删掉左括号"也能全绿
  assert.equal(splitBack('【重要】お知らせ').tl, '【重要】お知らせ', '正文里的方括号被误删了');
});

// 光验"有没有回訳"是不够的 —— 2026-08-26 实测：模型把译文原样抄进了 回訳 栏，
// 两栏一字不差。**这样的检查等于没有检查，而且更糟：它给假安心。**
// 我的探针当时只查了"回訳 在不在"，没查"它是不是真的在回译" —— 护栏只验存在
// 不验功能，同类毛病当天第九次。
// 根因是提示词顺序：方向说明排在后面、写着 Target language: Japanese，
// 模型就把回訳也写成了日语。修法是在方向说明里把回訳的语言写死。
test('★ 每个翻译方向都必须钉死【回訳】用哪种语言', () => {
  const dirs = ['ja-zh', 'zh-ja', 'en-zh', 'en-ja', 'zh-en', 'ja-en'];
  const missing = dirs.filter((d) => {
    const i = STREAM.indexOf(`'${d}':`);
    if (i === -1) return true;
    // 取这一项到下一项之间的文本
    const rest = STREAM.slice(i, i + 400);
    return !/【回訳】 line MUST be written in/.test(rest);
  });
  assert.deepEqual(
    missing,
    [],
    `这些方向没有钉死回訳的语言，模型会把译文原样抄一遍：${missing.join(', ')}`,
  );
  // 反向对照：不能靠"到处贴同一句"糊弄 —— 每个方向指定的语言必须各不相同地
  // 对应它自己的输入语言
  assert.match(STREAM, /'zh-ja':[\s\S]{0,300}?written in Simplified Chinese/);
  assert.match(STREAM, /'ja-zh':[\s\S]{0,300}?written in Japanese/);
  assert.match(STREAM, /'en-ja':[\s\S]{0,300}?written in English/);
});
