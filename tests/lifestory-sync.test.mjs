import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLifestorySync, lifestoryDocPath } from '../js/shared/lifestory-sync.js';

// 这套断言守的是**降级保证**：
// 服务端同步是加上去的增量能力，Firestore 规则还没放行、网络断了、用户没登录，
// 都必须退回"和以前完全一样"，而不是让一个本来能用的工具变成不能用的。
//
// 为什么非测不可：这段代码上线时规则**还没加**，所以「被拒」是它的**常态**，
// 不是边缘情况。常态路径没测过就等于没测。

function fakeFs({ getDoc, setDoc } = {}) {
  const calls = { setDoc: [], getDoc: 0, deleteDoc: [] };
  return {
    calls,
    fs: {
      doc: (...args) => ({ path: args.slice(1).join('/') }),
      getDoc: async (ref) => {
        calls.getDoc++;
        if (getDoc) return getDoc(ref);
        return { exists: () => false };
      },
      setDoc: async (ref, data, opts) => {
        calls.setDoc.push({ ref, data, opts });
        if (setDoc) return setDoc(ref, data, opts);
      },
      deleteDoc: async (ref) => {
        calls.deleteDoc.push({ ref });
      },
    },
  };
}

const state = (over = {}) => ({
  answers: [{ id: 'a1', answer: '甲', timestamp: 1 }],
  usedIds: ['a1'],
  anchorsDone: [],
  tags: [],
  historicalUsed: 0,
  followupCount: 0,
  lastAnalysis: null,
  lastStory: null,
  draft: { qId: null, text: '', privacy: false },
  themeFilter: null,
  updatedAt: 1000,
  ...over,
});

test('存档路径是按用户隔离的子集合', () => {
  assert.deepEqual(lifestoryDocPath('uid123'), ['users', 'uid123', 'lifestory', 'current']);
  // ⚠️ 路径里必须带 uid：规则靠它把每个人的存档隔开。
  assert.ok(lifestoryDocPath('uid123').includes('uid123'));
});

test('★ 规则拒绝时 pull 返回 null 而不是抛异常（这是上线初期的常态路径）', async () => {
  const { fs } = fakeFs({
    getDoc: async () => {
      const e = new Error('Missing or insufficient permissions.');
      e.code = 'permission-denied';
      throw e;
    },
  });
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  assert.equal(await sync.pull(), null);
});

test('★ 规则拒绝时 push 不抛异常，主流程不受影响', async () => {
  const { fs } = fakeFs({
    setDoc: async () => {
      throw new Error('Missing or insufficient permissions.');
    },
  });
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  assert.equal(await sync.pushNow(state()), false);
  // 防抖那条路也不许把异常抛到调用方（saveState 里调的就是它）
  assert.doesNotThrow(() => sync.push(state()));
  await sync.flush();
});

test('远端还没有这份文档时，pull 返回 null（首次使用）', async () => {
  const { fs } = fakeFs();
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  assert.equal(await sync.pull(), null);
});

test('远端数据坏掉时 pull 返回 null 而不是把坏数据交出去', async () => {
  for (const bad of [{ state: '{不是合法JSON' }, { state: 42 }, {}, null]) {
    const { fs } = fakeFs({ getDoc: async () => ({ exists: () => true, data: () => bad }) });
    const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
    assert.equal(await sync.pull(), null, `远端是 ${JSON.stringify(bad)} 时没兜住`);
  }
});

test('往返一致：写进去什么，读出来还是什么', async () => {
  let stored = null;
  const { fs } = fakeFs({
    setDoc: async (_ref, data) => {
      stored = data;
    },
    getDoc: async () => ({ exists: () => true, data: () => stored }),
  });
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  const s = state({ answers: [{ id: 'a1', answer: '带中文和 emoji 🎏', timestamp: 7 }] });
  assert.equal(await sync.pushNow(s), true);
  assert.deepEqual(await sync.pull(), s);
});

test('写入带上 answerCount，便于在控制台一眼看出进度', async () => {
  const { fs, calls } = fakeFs();
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  await sync.pushNow(state({ answers: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }));
  assert.equal(calls.setDoc[0].data.answerCount, 3);
  assert.equal(calls.setDoc[0].opts.merge, true);
});

test('★ 存档超过大小上限时不静默跳过 —— 必须报出来', async () => {
  const { fs, calls } = fakeFs();
  const seen = [];
  const sync = createLifestorySync({
    db: {},
    uid: 'u1',
    fs,
    onError: (where, err) => seen.push([where, err.message]),
  });
  const huge = state({ answers: [{ id: 'a1', answer: 'x'.repeat(900 * 1024), timestamp: 1 }] });
  assert.equal(await sync.pushNow(huge), false);
  assert.equal(calls.setDoc.length, 0, '超限了还是发出去了');
  assert.equal(seen.length, 1, '超限没有留下任何痕迹 —— 用户会以为存上了');
  assert.match(seen[0][1], /超过/);
});

test('★ 防抖：连续多次 saveState 只产生一次网络写', async () => {
  const { fs, calls } = fakeFs();
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  for (let i = 0; i < 5; i++) sync.push(state({ updatedAt: 1000 + i }));
  assert.equal(calls.setDoc.length, 0, '防抖窗口里就发出去了');
  await sync.flush();
  assert.equal(calls.setDoc.length, 1, '应当只写一次');
  // 写出去的必须是**最后**那份，不是第一份
  assert.equal(JSON.parse(calls.setDoc[0].data.state).updatedAt, 1004);
});

test('重置会删掉服务端那份 —— 只删本地的话重载时又被拉回来', async () => {
  const { fs, calls } = fakeFs();
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  assert.equal(await sync.clear(), true);
  assert.equal(calls.deleteDoc.length, 1);
});

// ★ 这条守的是一个只在删除路径上存在、平时没人走的竞态。
test('★ 重置之后，防抖里攒着的那次不许把存档写回去', async () => {
  const { fs, calls } = fakeFs();
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  sync.push(state()); // 用户答完题，3 秒防抖计时开始
  await sync.clear(); // 立刻点了重置
  await new Promise((r) => setTimeout(r, 50));
  await sync.flush(); // 把可能残留的都逼出来
  assert.equal(
    calls.setDoc.length,
    0,
    '重置后存档又被写回服务端了 —— 用户会看到「重置了一下，它自己回来了」',
  );
});

test('规则拒绝删除时 clear 不抛异常', async () => {
  const { fs } = fakeFs();
  fs.deleteDoc = async () => {
    throw new Error('Missing or insufficient permissions.');
  };
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  assert.equal(await sync.clear(), false);
});

test('flush 在没有待写内容时是安全的空操作', async () => {
  const { fs, calls } = fakeFs();
  const sync = createLifestorySync({ db: {}, uid: 'u1', fs });
  assert.equal(await sync.flush(), false);
  assert.equal(calls.setDoc.length, 0);
});
