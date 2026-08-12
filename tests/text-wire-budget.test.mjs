// 客户端 → Function 这一段的文本预算，以及"前端粗筛 + 服务端精筛"两级筛选。
//
// 为什么有这个文件：2026-08-12 作者线上实跑，页面报「请求内容过大（6.8MB，上限 3MB）」。
// 图像路径被 IMG_TOTAL_BUDGET=800KB 卡着，结构上到不了 6.8MB —— 6.8MB 只可能来自文本，
// 而文本路径当时**一个字节的预算都没有**（buildFileContent 有提问就 return 全文）。
// 服务端 CHAR_BUDGET=80000 那道筛选发生在**载荷过完线之后**，而 3MB 闸门和 Workers
// 10ms CPU 配额卡在线上这一段。
//
// 两级筛选为什么不重犯 4c73767 修掉的错：那次的问题不是"前端筛了"，而是前端用的
// scoreSection 是**问题盲**的（只数财务关键词密度，不看用户问什么），于是精筛还没
// 上场，答案所在的段落已经被扔掉。这里前端用的是和服务端**同一个** IDF 打分器、
// 同一个问题，只是预算更宽 —— 同一个排序跑两次，第二次从第一次的高分子集里挑。
//
// 断言用的是**真实 UTF-8 字节数**而不是字符数：线上卡的是字节（content-length），
// 而 selectRelevantPassages 的 budget 是内容字符预算、输出还会多出分离器（实测超 4.1%）。
// 用字符数断言就等于绕开了真正要守的那个量。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  textCharBudget,
  SERVER_CHAR_BUDGET,
  WIRE_BUDGET_BYTES,
  MIN_USEFUL_CHARS,
} from '../js/shared/text-wire-budget.js';
import { selectRelevantPassages } from '../js/shared/select-relevant-passages.js';

const EXCERPT = readFileSync(
  fileURLToPath(new URL('./fixtures/huawei-2024-notes-excerpt.txt', import.meta.url)),
  'utf8',
);

const QUESTION = '华为处置子公司荣耀产生的利润，对财务报表有多大影响';

const FILLER =
  '华为坚持以客户为中心，持续投入研发，推动产业健康发展。本节讨论经营环境与业务进展，' +
  '涵盖运营商业务、企业业务与消费者业务的整体表现，以及区域市场的经营情况。' +
  '本集团持续优化产品组合，加强供应链韧性，并在数字能源与智能汽车解决方案等领域扩大投入。';

/**
 * 造一份"像真实年报抽取结果"的长文：目标附注埋在 85% 处，前后全是含高频词「华为」
 * 的填充段。两条形状上的讲究：
 *   · **用单换行拼接、整篇不留空行** —— 42e99e8 踩过这个坑：真实 PDF 抽取出来整篇
 *     没有空行，按空行切块会把 17 万字当成一块。夹具留空行会走另一条分支，绿是假的。
 *   · **总长要超过最宽的那一级预算**（单文件 30 万字量级），否则 selectRelevantPassages
 *     直接走"整篇装得下"的短路，筛选分支根本没被测到。
 */
function buildLongDoc() {
  const parts = [];
  const fillerBlocks = 2400;
  const insertAt = Math.floor(fillerBlocks * 0.85);
  for (let i = 0; i < fillerBlocks; i++) {
    if (i === insertAt) parts.push(EXCERPT);
    parts.push(`第 ${i + 1} 节 经营讨论与分析 ${FILLER}`);
  }
  return parts.join('\n');
}

const DOC = buildLongDoc();

test('夹具自检：目标数字只来自真实年报切片，填充段不含它，且长度够走筛选分支', () => {
  // 没有这条，下面的断言可能因为填充段里恰好有同样的字而永远为真（vacuous green）
  assert.ok(EXCERPT.includes('55,853'), '夹具应含 55,853');
  assert.ok(EXCERPT.includes('荣耀'), '夹具应含「荣耀」');
  assert.ok(!FILLER.includes('55,853'), '填充段不许含 55,853');
  assert.ok(!FILLER.includes('荣耀'), '填充段不许含「荣耀」');
  assert.ok(!DOC.includes('\n\n'), '夹具不许有空行——真实 PDF 抽取结果没有空行');
  assert.ok(
    DOC.length > textCharBudget(1),
    `夹具必须超过最宽预算才测得到筛选分支（${DOC.length} vs ${textCharBudget(1)}）`,
  );
});

test('预算按文件数均分，按 CJK 每字 3 字节换算，并扣掉分离器开销', () => {
  // 1MB / 1 份 = 1048576 字节；/(3 × 1.15) = 303935 字
  assert.equal(textCharBudget(1), 303935);
  // 两份各半：524288 字节 /(3 × 1.15) = 151967 字
  assert.equal(textCharBudget(2), 151967);
});

// 回归：这里曾把下限设成 SERVER_CHAR_BUDGET(80000)，理由是"送得比服务端会用的还少
// 纯属自伤"。那个理由只管单份质量、不管总量。当 image-path-viable 让「6 份文件全走
// 文本」成为常态后，6 × 80000 × 3 字节 ≈ 1.44MB > 已知能跑通的 1.1MB —— 为了单份不
// 吃亏，把整次请求推向 10ms CPU 墙。**总量约束优先于单份质量。**
test('多文件时总字节仍压在线上预算内（下限不许把总量顶穿）', () => {
  for (const n of [2, 3, 6, 10, 15]) {
    const totalBytes = textCharBudget(n) * n * 3;
    assert.ok(
      totalBytes <= WIRE_BUDGET_BYTES * 1.02,
      `${n} 份文件时总量 ${(totalBytes / 1048576).toFixed(2)}MB 超出预算`,
    );
  }
});

test('单份不再往下摊到没有检索价值的量', () => {
  assert.equal(MIN_USEFUL_CHARS, 20000);
  assert.equal(textCharBudget(100), MIN_USEFUL_CHARS);
  assert.ok(textCharBudget(6) > MIN_USEFUL_CHARS, '6 份还远没到下限');
});

test('文件数为 0/负数/非数不炸，回落到服务端预算', () => {
  assert.equal(textCharBudget(0), SERVER_CHAR_BUDGET);
  assert.equal(textCharBudget(-1), SERVER_CHAR_BUDGET);
  assert.equal(textCharBudget(NaN), SERVER_CHAR_BUDGET);
  assert.equal(textCharBudget(undefined), SERVER_CHAR_BUDGET);
});

test('粗筛把真实字节数压进线上预算内（这条红了说明预算是摆设）', () => {
  for (const n of [1, 2]) {
    const coarse = selectRelevantPassages(DOC, QUESTION, { budget: textCharBudget(n) });
    assert.equal(coarse.mode, 'selected', `${n} 份文件时应走筛选分支而非整篇送`);
    const bytes = Buffer.byteLength(coarse.text, 'utf8');
    const allowed = Math.floor(WIRE_BUDGET_BYTES / n);
    assert.ok(bytes <= allowed, `${n} 份文件时粗筛没压进预算：${bytes} > ${allowed} 字节`);
  }
});

test('两级筛选不丢答案：粗筛后再精筛，55,853 与荣耀归因都还在', () => {
  const coarse = selectRelevantPassages(DOC, QUESTION, { budget: textCharBudget(2) });
  assert.ok(coarse.text.includes('55,853'), '粗筛就把答案数字扔了');
  assert.ok(coarse.text.includes('荣耀'), '粗筛就把荣耀那段扔了');

  // 服务端拿到的是粗筛结果，再按同样的问题精筛到 80000
  const fine = selectRelevantPassages(coarse.text, QUESTION, { budget: SERVER_CHAR_BUDGET });
  assert.ok(fine.text.includes('55,853'), '精筛把答案数字扔了');
  assert.ok(fine.text.includes('荣耀'), '精筛把荣耀那段扔了');
});

test('两级筛选与单级直筛拿到的关键内容一致（粗筛不改变结论）', () => {
  const oneStep = selectRelevantPassages(DOC, QUESTION, { budget: SERVER_CHAR_BUDGET });
  const coarse = selectRelevantPassages(DOC, QUESTION, { budget: textCharBudget(2) });
  const twoStep = selectRelevantPassages(coarse.text, QUESTION, { budget: SERVER_CHAR_BUDGET });

  // 单级本来就能找到（这是今天线上的行为），两级不许比它差
  assert.ok(oneStep.text.includes('55,853'), '对照组：单级直筛应能找到');
  assert.ok(twoStep.text.includes('55,853'), '两级比单级差了 —— 粗筛引入了回归');
  assert.ok(twoStep.hitTerms.length > 0, '两级后命中词不该为空');
});

test('highlights 在两级之后仍然产出（模型靠它才看得见那根针）', () => {
  // 2026-08-11 实测：荣耀在 8 万字里只出现 1 次、位于 77% 处，模型直接没看见。
  // highlights 是为此加的（ea9cee8），两级筛选不许把它弄没。
  const coarse = selectRelevantPassages(DOC, QUESTION, { budget: textCharBudget(2) });
  const fine = selectRelevantPassages(coarse.text, QUESTION, { budget: SERVER_CHAR_BUDGET });
  assert.ok(fine.highlights.length > 0, '精筛后没有 highlights');
  assert.ok(
    fine.highlights.some((h) => h.includes('荣耀')),
    'highlights 里没有含荣耀的块',
  );
});

// 这条不是在测我们的代码，是在**钉住 selectRelevantPassages 的已知偏差**：
// 它的 budget 是内容预算，输出会因为块间的「中间内容已省略」提示而超出。
// SEPARATOR_OVERHEAD=0.15 就是按这个偏差留的；偏差要是变大，预算换算会失真，
// 而线上再没有别的东西拦得住（3MB 闸门只会把它变成一个 413）。
test('已知偏差钉住：selectRelevantPassages 的输出超出 budget 不超过 15%', () => {
  const fine = selectRelevantPassages(DOC, QUESTION, { budget: SERVER_CHAR_BUDGET });
  const ratio = fine.text.length / SERVER_CHAR_BUDGET - 1;
  assert.ok(ratio > 0, '若不再超预算，说明上游改好了，可以把 SEPARATOR_OVERHEAD 调小');
  assert.ok(ratio <= 0.15, `超出 ${(ratio * 100).toFixed(1)}%，已超过 SEPARATOR_OVERHEAD 留量`);
});
