import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeState, answerKey, isBlank, hasDraftText } from '../js/shared/lifestory-merge.js';

// 这套断言守的是一件事：**答过的问题不会变回没答。**
// 访谈存档从"只在 localStorage"改成"服务端也有一份"之后，两边就可能各有内容。
// 合并写错的后果不是报错，是**用户的回答安静地少了几条**——而人生故事这种东西，
// 少一条没人会立刻发现，发现时也无从找回。

const ans = (id, text, timestamp) => ({
  id,
  type: 'anchor',
  cat: 'origin',
  question: 'q' + id,
  answer: text,
  analysis: null,
  timestamp,
  privacy: false,
});

const st = (over = {}) => ({
  answers: [],
  usedIds: [],
  anchorsDone: [],
  tags: [],
  historicalUsed: 0,
  followupCount: 0,
  lastAnalysis: null,
  lastStory: null,
  draft: { qId: null, text: '', privacy: false },
  themeFilter: null,
  updatedAt: 0,
  ...over,
});

test('护栏自身有效：夹具不是退化输入', () => {
  // 两边都为空的话，下面每一条断言都会"自动通过"而什么也没测到。
  const r = st({ answers: [ans('a1', '甲', 100)] });
  const l = st({ answers: [ans('a2', '乙', 200)] });
  assert.ok(r.answers.length > 0 && l.answers.length > 0);
  assert.notDeepEqual(r.answers, l.answers, '两边夹具必须真的不同');
});

test('★ 两边各有回答时，一条都不能少', () => {
  const remote = st({ answers: [ans('a1', '甲', 100)], updatedAt: 100 });
  const local = st({ answers: [ans('a2', '乙', 200)], updatedAt: 200 });
  const m = mergeState(remote, local);
  assert.equal(m.answers.length, 2, '并集应有 2 条');
  const ids = m.answers.map((a) => a.id).sort();
  assert.deepEqual(ids, ['a1', 'a2']);
});

test('★ 远端更新时，本地的回答也不许被盖掉（这是最容易写反的一处）', () => {
  // 远端 updatedAt 更大 —— 天真写法会整份取远端，本地那条就没了。
  const remote = st({ answers: [ans('a1', '甲', 100)], updatedAt: 9999 });
  const local = st({ answers: [ans('a2', '乙', 200)], updatedAt: 1 });
  const m = mergeState(remote, local);
  assert.equal(m.answers.length, 2, '远端较新时本地回答被丢弃了');
});

test('同一条记录不会被算成两条', () => {
  const same = ans('a1', '同一个答案', 100);
  const m = mergeState(st({ answers: [same] }), st({ answers: [{ ...same }] }));
  assert.equal(m.answers.length, 1);
});

test('同一道题在两台设备上答了不同内容 —— 两条都留', () => {
  const m = mergeState(
    st({ answers: [ans('a1', '在电脑上写的', 100)] }),
    st({ answers: [ans('a1', '在手机上写的', 300)] }),
  );
  assert.equal(m.answers.length, 2, '内容不同就是两次回答，丢哪条都是数据丢失');
});

test('★ 合并是幂等的（同步跑两次不会翻倍）', () => {
  const remote = st({ answers: [ans('a1', '甲', 100)], usedIds: ['a1'], updatedAt: 100 });
  const local = st({ answers: [ans('a2', '乙', 200)], usedIds: ['a2'], updatedAt: 200 });
  const once = mergeState(remote, local);
  const twice = mergeState(once, mergeState(remote, local));
  assert.deepEqual(twice.answers, once.answers, '再合并一次结果变了');
  assert.deepEqual(twice.usedIds, once.usedIds);
});

test('★ 合并结果不会比任何一边短', () => {
  const remote = st({ answers: [ans('a1', '甲', 1), ans('a2', '乙', 2)], updatedAt: 5 });
  const local = st({ answers: [ans('a3', '丙', 3)], updatedAt: 9 });
  const m = mergeState(remote, local);
  assert.ok(m.answers.length >= remote.answers.length);
  assert.ok(m.answers.length >= local.answers.length);
});

test('usedIds / anchorsDone / tags 都取并集', () => {
  const m = mergeState(
    st({ usedIds: ['a', 'b'], anchorsDone: ['a'], tags: ['军人'] }),
    st({ usedIds: ['b', 'c'], anchorsDone: ['c'], tags: ['上海'] }),
  );
  assert.deepEqual(m.usedIds.sort(), ['a', 'b', 'c']);
  assert.deepEqual(m.anchorsDone.sort(), ['a', 'c']);
  assert.deepEqual(m.tags.sort(), ['上海', '军人']);
});

test('historicalUsed 取大 —— 取小会让历史题超过上限', () => {
  const m = mergeState(st({ historicalUsed: 2 }), st({ historicalUsed: 1 }));
  assert.equal(m.historicalUsed, 2);
});

test('★ 本地正在写的草稿永远不被远端盖掉', () => {
  const remote = st({
    draft: { qId: 'a1', text: '远端的旧草稿', privacy: false },
    updatedAt: 9999,
  });
  const local = st({ draft: { qId: 'a2', text: '我正在打的字', privacy: false }, updatedAt: 1 });
  const m = mergeState(remote, local);
  assert.equal(m.draft.text, '我正在打的字', '正在输入的内容被后台同步抹掉了');
});

test('本地草稿是空的时候，才轮到用较新那份', () => {
  const remote = st({ draft: { qId: 'a1', text: '远端草稿', privacy: false }, updatedAt: 9999 });
  const local = st({ draft: { qId: null, text: '   ', privacy: false }, updatedAt: 1 });
  assert.equal(mergeState(remote, local).draft.text, '远端草稿');
});

test('成文结果不会因为另一边没有就丢掉', () => {
  const m = mergeState(st({ lastStory: '我的一生……', updatedAt: 1 }), st({ updatedAt: 999 }));
  assert.equal(m.lastStory, '我的一生……');
});

test('一边不存在时原样返回另一边（首次同步 / 远端还没有）', () => {
  const local = st({ answers: [ans('a1', '甲', 1)] });
  assert.deepEqual(mergeState(null, local), local);
  assert.deepEqual(mergeState(local, null), local);
});

test('isBlank：只有真正空白的存档才允许被远端整份取代', () => {
  assert.ok(isBlank(st()));
  assert.ok(isBlank(null));
  assert.ok(!isBlank(st({ answers: [ans('a1', '甲', 1)] })));
  assert.ok(!isBlank(st({ lastStory: '故事' })));
  assert.ok(!isBlank(st({ draft: { qId: 'a1', text: '写了一半', privacy: false } })));
  // ⚠️ 只有空格的草稿不算内容，否则光标点进去就再也恢复不了远端存档
  assert.ok(isBlank(st({ draft: { qId: 'a1', text: '   ', privacy: false } })));
});

test('hasDraftText 认得出空白与纯空格', () => {
  assert.ok(hasDraftText({ draft: { text: 'x' } }));
  assert.ok(!hasDraftText({ draft: { text: '' } }));
  assert.ok(!hasDraftText({ draft: { text: '  \n ' } }));
  assert.ok(!hasDraftText({}));
  assert.ok(!hasDraftText(null));
});

test('answerKey 对坏数据不抛异常（存档可能被手改坏）', () => {
  assert.equal(answerKey(null), '');
  assert.equal(answerKey(undefined), '');
  assert.equal(typeof answerKey({ id: 'a' }), 'string');
});

test('★ 坏掉的远端数据不会让本地存档消失', () => {
  const local = st({ answers: [ans('a1', '甲', 1)] });
  for (const bad of [undefined, null, 'not an object', 42]) {
    assert.deepEqual(mergeState(bad, local), local, `远端是 ${String(bad)} 时本地被弄丢了`);
  }
});
