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
const SUMMARY = stripComments(
  readFileSync(path.join(ROOT, 'functions', 'api', 'summary.js'), 'utf8'),
);
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

function fnBody(name) {
  const m = PAGE.match(new RegExp(`async function ${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n {4}\\}`));
  assert.ok(m, `找不到 ${name}`);
  return m[0];
}

function syncFnBody(name) {
  const m = PAGE.match(new RegExp(`\\n {4}function ${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n {4}\\}`));
  assert.ok(m, `找不到 ${name}`);
  return m[0];
}

function decl(re, what) {
  const m = PAGE.match(re);
  assert.ok(m, `找不到 ${what}`);
  return m[0];
}

// ── 背景 ────────────────────────────────────────────────────────────────────
// 2026-08-26 语音口译实测：Deepgram 中文听写四段错七处，而翻译层把坏输入
// 「修」成了流畅、笃定、看不出问题的假话 —— 编出原文没有的美元、把听错的
// 「党招」解成政治组织、把「负责人」升成「部長」、把三件独立的事合并成一句
// 并凭空造出从属关系。
//
// 作者定的取舍（2026-08-27 原话）：**信 > 达 > 雅**；
// 「搞出一个无法识别的错误编造对我来说会有更大的问题，宁可说这句话看着不对，
//   我重新说一遍都更好。」
// 这条决定了下面所有断言的方向：**可见的失败优于隐形的编造。**

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
// 试过让主调用顺带输出【回訳】，两版都坏：第一版把译文原样抄进回訳栏；
// 第二版改用中文之后，它改抄输入原文。两种都等于没有检查，而且更糟 —— 给假安心。
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
  const read = fnBody('readBackStream');
  assert.match(read, /requestTranslate\(\s*'\/api\/translate-stream'/, '回译没有走翻译接口');
  assert.match(
    read,
    /content: translated/,
    '回译喂进去的不是译文参数 —— 只要原文能进到这次调用里，它就会抄原文',
  );
  assert.match(read, /direction:\s*`\$\{fromLang\}-\$\{toLang\}`/, '回译没有用反过来的方向');

  // ★ 关键：两个函数里都不能出现源文本。它们的入参里根本没有 text/src，
  //   有的话说明有人把原文传进来了，回译就又能作弊了。
  for (const name of ['readBackStream', 'requestBackTranslation']) {
    const body = fnBody(name);
    for (const bad of ['text', 'src']) {
      assert.ok(
        !new RegExp(`content:\\s*${bad}\\b`).test(body),
        `${name} 里出现了 content: ${bad} —— 原文进来了，它就会抄原文而不是真回译`,
      );
    }
  }
});

test('★ 回译失败不许静默 —— 它是防编造的那道检查，静默失效等于检查没了', () => {
  assert.match(
    fnBody('requestBackTranslation'),
    /catch \(err\)[\s\S]*console\.warn/,
    '回译的 catch 是静默的',
  );
});

test('★ 口译不等回译 —— 不许 await，否则现场每句都要多等一次往返', () => {
  assert.ok(!/await\s+requestBackTranslation/.test(PAGE), 'await 了回译，口译会被拖慢一个来回');
  assert.match(PAGE, /\n\s*requestBackTranslation\(fullText,/, '主流程没有发起回译');
});

test('★ 朗读只念译文，导出/历史也不含回译', () => {
  assert.match(PAGE, /speakText\(fullText,\s*speakerLang\[tgtSpk\]\)/, '朗读没有念译文');
  assert.match(PAGE, /tgt:\s*fullText,/, '历史记录存的不是译文');
  assert.match(PAGE, /back:\s*'',/, 'back 字段初始值不是空串（可能被译文顶替了）');
});

test('回译有独立的展示位，且默认隐藏（没回来之前不占地方）', () => {
  assert.match(PAGE_RAW, /class="cue-back" hidden/, '缺少 .cue-back 展示位或它默认不是隐藏的');
  assert.match(PAGE_RAW, /\.cue-back\s*\{/, '缺少 .cue-back 的样式');
  const at = PAGE_RAW.indexOf('.cue-back {');
  assert.match(PAGE_RAW.slice(at, at + 400), /font-size:\s*0\./, '回译的字号没有小于译文');
});

// ── 回译回来之后还得验语种 ──────────────────────────────────────────────────
// 实测 12 次里有 2 次，回译回来的还是日语（模型把译文润色一遍就交差）。
// 那种"看着像回译、其实不是"的东西最危险：用户对着两栏点头，以为校验过了。
test('★ 回译语种校验：日语冒充中文回译必须被抓到', () => {
  const kana = PAGE.match(/const KANA_RE = \/\[[^\]]*\]\/;/);
  assert.ok(kana, '找不到 KANA_RE');
  const body = PAGE.match(/function backLooksRight\([\s\S]*?\n {4}\}/);
  assert.ok(body, '找不到 backLooksRight —— 回译的语种校验没了');
  const backLooksRight = new Function(`${kana[0]} ${body[0]}; return backLooksRight;`)();

  assert.equal(
    backLooksRight('本次预算为3,200万日元，较去年增长15%。', 'zh'),
    true,
    '正常中文回译被误判',
  );
  assert.equal(
    backLooksRight('今回の予算は3,200万円で、昨年比15％増です。', 'zh'),
    false,
    '★ 日语冒充中文回译没被抓到 —— 这正是实测中出现过的那两次',
  );
  assert.equal(backLooksRight('', 'zh'), false, '空回译该判不合格');
  // 反向对照：ja 方向不能一律判不合格，否则"永远返回 false"也能让上面全绿
  assert.equal(
    backLooksRight('今回の予算は3,200万円です。', 'ja'),
    true,
    'ja 方向的正常回译被误判',
  );
  assert.equal(backLooksRight('本次预算为3200万日元。', 'ja'), false, '中文冒充日语回译没被抓到');
});

// ── 抄写闸门 ────────────────────────────────────────────────────────────────
// 语种闸门有个结构性漏洞：**日语可以整句不含假名**（「会議室変更」「担当者確認中」），
// 抄回来的这种日语会被判成"合格的中文回译"。抄写闸门补的是这个。
//
// 2026-09-04 走生产路径实测（同端点 / 同模型 qwen3.7-flash / 同提示词 / 同温度），
// 22 条 × 3 遍 = 66 个真实往返，覆盖普通会议句 / 短全汉字句 / 听写坏掉的片段：
//     真回译的相似度  普通句 max 0.26 全汉字句 max 0.18
//     抄写的相似度    0.71 和 1.00
// 阈值 0.5 落在这条空档正中，66 个样本零误伤。下面的样例就是那次实测里的真数据。
test('★ 抄写闸门：真回译与抄写之间要留得住那条缝', () => {
  const sim = new Function(
    decl(/const BACK_PUNCT_RE = [^\n]*\n/, 'BACK_PUNCT_RE') +
      syncFnBody('backNorm') +
      syncFnBody('backSimilarity') +
      decl(/const BACK_COPY_MAX = [^\n]*\n/, 'BACK_COPY_MAX') +
      syncFnBody('backLooksCopied') +
      '; return { backSimilarity, backLooksCopied, BACK_COPY_MAX };',
  )();

  // 抄写：实测里模型对「党招」这种听写垃圾回译不动，就把译文原样抄了回来
  assert.equal(
    sim.backLooksCopied(
      '相手側の党招と連絡を取ればよいです。',
      '相手側の党招と連絡を取ればよいです。',
    ),
    true,
    '★ 一字不差的抄写没被抓到',
  );
  // 抄写的另一种形态：润色一遍。这一条实测相似度 0.71
  assert.equal(
    sim.backLooksCopied(
      '相手の党の招へいと連絡を取ればよいです。',
      '相手側の党招と連絡を取ればよいです。',
    ),
    true,
    '★ "润色一遍就交差"没被抓到 —— 那正是实测中出现过的形态',
  );
  // 真回译不能被误伤。下面三条都是实测数据，相似度分别是 0.26 / 0.10 / 0.00
  for (const [back, tl, what] of [
    [
      '本次预算为3,200万日元，同比增长15%。',
      '今回の予算は3,200万円で、前年比15％増です。',
      '数字多的句子',
    ],
    ['明天上午10点开始。', '明日の午前10時に開始します。', '短·全汉字句'],
    ['正在确认负责人。', '責任者の確認中です。', '短句'],
  ]) {
    assert.equal(sim.backLooksCopied(back, tl), false, `真回译被误伤：${what}`);
  }
  // 护栏自身有效：阈值必须落在实测那条缝里，挪出去这套断言就白写了
  assert.ok(
    sim.BACK_COPY_MAX > 0.26 && sim.BACK_COPY_MAX < 0.71,
    `阈值 ${sim.BACK_COPY_MAX} 已经不在实测的 0.26↔0.71 空档里`,
  );
});

// ── 失败要可见，且要给出"重说一遍"的出路 ──────────────────────────────────
// 作者的取舍：宁可这句看着不对、重新说一遍，也不要一个识别不出的编造。
// 所以回译挂掉时不能藏 —— 藏了人就连"看着不对"的机会都没有。
test('★ 回译不合格时必须重试一次', () => {
  const fn = fnBody('requestBackTranslation');
  assert.match(
    fn,
    /if \(why\)[\s\S]{0,300}?readBackStream\(translated,/,
    '不合格时没有重试 —— 一次失败就永远失败',
  );
  // 只重试一次：现场口译等不起，而且模型要是稳定不听话，重试多少次都一样
  const calls = (fn.match(/readBackStream\(/g) || []).length;
  assert.equal(calls, 2, `readBackStream 调了 ${calls} 次，应该是"首次 + 重试一次"共 2 次`);
});

test('★ 判定的默认值必须站在"未校验"那边', () => {
  const fn = fnBody('requestBackTranslation');
  assert.match(
    fn,
    /let why = 'error';/,
    "why 的初值不是 'error' —— 中途抛异常时这一句会被当成校验通过，护栏等于没有",
  );
  // 网络挂了也要标出来。原来这条路只有 console.warn，界面上一片空白，
  // 而"回译没出现"和"这句没校验"在界面上长得一模一样。
  const at = fn.indexOf('catch (err)');
  assert.ok(at > 0, 'requestBackTranslation 没有 catch');
  assert.ok(
    fn.indexOf('markBackResult(') > at,
    '★ catch 之后没有走 markBackResult —— 网络失败时界面上看不出这句没校验过',
  );
});

test('★ 重试也没救回来时，要明说这句未经校验、建议重说', () => {
  assert.match(PAGE, /window\.sdfT\('tl_back_unverified'\)/, '警告文案没走 i18n');
  assert.match(
    MAIN,
    /tl_back_unverified: '⚠ 回译没成功，这一句未经校验，建议重说一遍'/,
    '中文文案不对',
  );
  // 三语对齐由 i18n-keys.test.mjs 保证，这里只确认这个键三个语种块里都有
  const hits = (MAIN.match(/tl_back_unverified:/g) || []).length;
  assert.equal(hits, 3, `tl_back_unverified 只在 ${hits} 个语种块里，应该是 3 个`);
  assert.match(PAGE, /delete el\.dataset\.unverified/, '重试成功后没有清掉未校验标记');
});

// ── 标记必须活到纪要里 ──────────────────────────────────────────────────────
// ⚠ 只写进 DOM 的话，导出的 docx 和会议纪要拿不到它 —— 而纪要才是留下来、
// 被当成事实引用的那一份。最可疑的那一句反而在纪要里显得和别的一样确凿。
test('★ 未校验标记要落到历史记录，不能只在界面上', () => {
  assert.match(PAGE, /unverified: '',/, 'voiceHistory 的条目里没有 unverified 字段');
  const fn = syncFnBody('markBackResult');
  assert.match(fn, /entry\.unverified = why/, '判定结果没有写回历史记录条目');
  assert.match(fn, /entry\.back = back/, '回译没有写回历史记录条目');
});

test('★ 会议纪要必须知道哪一句没校验过', () => {
  assert.match(SUMMARY, /d\.unverified/, '纪要接口没有读 unverified —— 标记在这里断了');
  assert.match(SUMMARY, /※未校验/, '纪要的输入里没有把未校验的发言标出来');
  assert.match(
    SUMMARY,
    /不要用它作为行动项、数字、金额或承诺的唯一依据/,
    '提示词里没有说明未校验的发言该怎么处理',
  );
});
