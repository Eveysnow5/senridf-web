// 多轮循环的终止逻辑。这段本来写在 analysis.html 的内联脚本里，而 `npm run check`
// 覆盖不到内联脚本——循环里最危险的恰恰是"什么时候停"，所以抽出来单测。
//
// 每条测试对应一条真实的失效方式：漏掉一条终止路径 = 用户白等两分钟拿不到答案。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideNextRound } from '../js/shared/multiround-flow.js';
import { parsePageRequest } from '../js/shared/parse-page-request.js';

const need = (obj) => ({ done: false, requests: obj });

test('终止路径①：模型说够了', () => {
  const r = decideNextRound({ done: true, requests: [] }, [new Set()], 1, 5);
  assert.deepEqual(r, { done: true, requests: [] });
});

// done 优先于残留的 requests。当前的 parsePageRequest 在 done 时必定返回空 requests，
// 所以这条在今天是防御性的——但它是这个函数的契约，换一个解析器就会真的用上。
// （突变验证发现：不写这条，删掉 parsed.done 判断也照样全绿。）
test('parsed.done 优先：即使还带着 requests 也停', () => {
  const r = decideNextRound(
    { done: true, requests: [{ fileIndex: 1, pages: [99] }] },
    [new Set()],
    1,
    5,
  );
  assert.deepEqual(r, { done: true, requests: [] });
});

test('终止路径②：索要的页全都取过了——模型在原地打转', () => {
  const sent = [new Set([86, 87])];
  const r = decideNextRound(need([{ fileIndex: 1, pages: [86, 87] }]), sent, 2, 5);
  assert.equal(r.done, true, '再给一遍同样的图不会有新信息，必须停');
});

test('终止路径③：轮数到顶', () => {
  const r = decideNextRound(need([{ fileIndex: 1, pages: [99] }]), [new Set()], 5, 5);
  assert.equal(r.done, true);
  // 越界轮次同样停（别靠调用方保证 round <= maxRounds）
  assert.equal(
    decideNextRound(need([{ fileIndex: 1, pages: [99] }]), [new Set()], 9, 5).done,
    true,
  );
});

test('部分重复时只取没看过的那几页，不整条作废', () => {
  const sent = [new Set([86])];
  const r = decideNextRound(need([{ fileIndex: 1, pages: [86, 87, 88] }]), sent, 2, 5);
  assert.equal(r.done, false);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [87, 88] }]);
});

test('某个文件全重复时把它整组丢掉，其余文件照常继续', () => {
  const sent = [new Set([86]), new Set()];
  const r = decideNextRound(
    need([
      { fileIndex: 1, pages: [86] },
      { fileIndex: 2, pages: [12] },
    ]),
    sent,
    2,
    5,
  );
  assert.deepEqual(r.requests, [{ fileIndex: 2, pages: [12] }]);
});

test('sentByFile 用数组而不是 Set 也能work（调用方两种都可能传）', () => {
  const r = decideNextRound(need([{ fileIndex: 1, pages: [86, 87] }]), [[86]], 2, 5);
  assert.deepEqual(r.requests, [{ fileIndex: 1, pages: [87] }]);
});

test('缺失/畸形入参一律停——多轮循环里"不确定"必须倒向停止', () => {
  assert.equal(decideNextRound(null, [], 1, 5).done, true);
  assert.equal(decideNextRound(undefined, [], 1, 5).done, true);
  assert.equal(decideNextRound(need([]), [], 1, 5).done, true);
  assert.equal(decideNextRound(need([{ fileIndex: 1, pages: [] }]), [], 1, 5).done, true);
  assert.equal(decideNextRound(need([{ fileIndex: 1, pages: [5] }]), undefined, 1, 5).done, false);
  assert.equal(decideNextRound(need([{ fileIndex: 1, pages: [5] }]), [], NaN, 5).done, true);
});

// 端到端：模型原话 → 解析 → 决策。两个纯函数拼起来的行为才是循环真正跑的东西。
test('串起来跑一遍：模型索要新页 → 继续；重复索要 → 停', () => {
  const totals = [148, 90];
  const sent = [new Set([86]), new Set()];

  const go = decideNextRound(
    parsePageRequest('NEED_PAGES: 文件1:87 文件2:12', 2, totals),
    sent,
    2,
    5,
  );
  assert.equal(go.done, false);
  assert.deepEqual(go.requests, [
    { fileIndex: 1, pages: [87] },
    { fileIndex: 2, pages: [12] },
  ]);

  const stop = decideNextRound(parsePageRequest('NEED_PAGES: 文件1:86', 2, totals), sent, 2, 5);
  assert.equal(stop.done, true, '只要了一页已看过的，应当停');

  const answered = decideNextRound(parsePageRequest('ANSWER: 结论是…', 2, totals), sent, 2, 5);
  assert.equal(answered.done, true);
});

test('循环必定终止：任意输入下最多跑 maxRounds 轮', () => {
  // 模拟最坏情况——模型每轮都索要同样的页、永远不说 ANSWER
  const sent = [new Set()];
  let round = 1;
  const maxRounds = 5;
  while (round <= maxRounds) {
    const parsed = parsePageRequest('NEED_PAGES: 文件1:86', 1, [148]);
    const d = decideNextRound(parsed, sent, round, maxRounds);
    if (d.done) break;
    for (const r of d.requests) for (const p of r.pages) sent[r.fileIndex - 1].add(p);
    round++;
  }
  assert.ok(round <= maxRounds, `跑了 ${round} 轮`);
  assert.equal(round, 2, '第 2 轮就该发现它在重复索要并停下');
});
