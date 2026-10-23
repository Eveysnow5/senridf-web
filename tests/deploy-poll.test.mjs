import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pollDeployStatus } from '../js/shared/deploy-poll.js';
import { deployState } from '../workers/sdf-admin/src/deploy-status.js';

// 这个模块存在的唯一理由，是把几种结局分开。原代码把它们合成了一种：
// `catch { /* 网络抖动 */ }` + 循环结束一句「上线状态未确认」，于是
// CSP 拦截、限流、断网、部署慢、被检查拦下，在界面上完全一样。
// 下面每条测试守的都是"这两种情况必须能分辨"，不是"函数跑得通"。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const noSleep = async () => {};

// ── 前端轮询 ──

test('Worker 回 live -> synced，且不再多轮询', async () => {
  let calls = 0;
  const r = await pollDeployStatus({
    sleep: noSleep,
    fetchStatus: async () => {
      calls++;
      return { state: calls >= 3 ? 'live' : 'pending' };
    },
  });
  assert.equal(r.state, 'synced');
  assert.equal(r.attempts, 3, '对上之后应立刻返回，不该跑满 15 次');
  assert.equal(calls, 3);
});

test('被检查拦下 -> blocked，立刻返回并带上那次运行的链接', async () => {
  let calls = 0;
  const r = await pollDeployStatus({
    sleep: noSleep,
    fetchStatus: async () => {
      calls++;
      return calls === 1 ? { state: 'pending' } : { state: 'blocked', runUrl: 'https://x/run/1' };
    },
  });
  assert.equal(r.state, 'blocked', '10-21 就是这种情况被说成了「还没上线」');
  assert.equal(r.runUrl, 'https://x/run/1');
  assert.equal(calls, 2, '拦下是终局，不该继续等到超时');
});

test('令牌缺 Actions 权限 -> no_permission，立刻返回（等多久都不会变）', async () => {
  let calls = 0;
  const r = await pollDeployStatus({
    sleep: noSleep,
    fetchStatus: async () => {
      calls++;
      return { state: 'no_permission' };
    },
  });
  assert.equal(r.state, 'no_permission');
  assert.equal(calls, 1);
});

test('查得到但一直没跑完 -> unconfirmed（部署确实慢，这句提示是对的）', async () => {
  const r = await pollDeployStatus({
    sleep: noSleep,
    attempts: 4,
    fetchStatus: async () => ({ state: 'pending' }),
  });
  assert.equal(r.state, 'unconfirmed');
  assert.equal(r.okResponses, 4, '拿到过 4 次成功响应');
});

test('请求全程抛错（CSP 拦截、Worker 502、限流 429 都长这样）-> unreachable', async () => {
  const r = await pollDeployStatus({
    sleep: noSleep,
    attempts: 3,
    fetchStatus: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(r.state, 'unreachable', '请求没通必须与"部署慢"区分开');
  assert.equal(r.okResponses, 0);
  assert.match(r.lastError.message, /Failed to fetch/, '最后一次错误要留下来给作者看');
});

test('先断网后恢复：只要成功过一次，就不是 unreachable', async () => {
  let n = 0;
  const r = await pollDeployStatus({
    sleep: noSleep,
    attempts: 4,
    fetchStatus: async () => {
      n++;
      if (n <= 2) throw new Error('net down');
      return { state: 'pending' };
    },
  });
  assert.equal(r.state, 'unconfirmed');
  assert.equal(r.okResponses, 2);
});

test('每次轮询之前都等待（否则会瞬间打满 15 个请求）', async () => {
  const waits = [];
  await pollDeployStatus({
    attempts: 3,
    intervalMs: 20000,
    sleep: async (ms) => waits.push(ms),
    fetchStatus: async () => ({ state: 'pending' }),
  });
  assert.deepEqual(waits, [20000, 20000, 20000]);
});

// 抽成共享模块的意义在于两个 admin 页用的是同一份。哪天有人在页面里
// 复制回一份本地实现，这条会红。
test('两个 admin 页都走 Worker 的共享轮询，不再直连镜像仓库', () => {
  for (const f of ['admin/index.html', 'admin/blog/index.html']) {
    const s = readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(
      s,
      /import \{ pollDeployStatus \} from '\/js\/shared\/deploy-poll\.js'/,
      `${f} 没引用共享模块`,
    );
    assert.doesNotMatch(s, /api\.github\.com/, `${f} 还在直连 GitHub（仓库转私有后会断）`);
    assert.match(s, /\/deploy-status\?sha=/, `${f} 没调 Worker 的 /deploy-status`);
    for (const st of ['synced', 'blocked', 'no_permission', 'unreachable']) {
      assert.match(s, new RegExp(`r\\.state === '${st}'`), `${f} 没有处理 ${st} 这一支`);
    }
  }
});

// ── Worker 端判定：用真实运行记录 ──
// 夹具是 2026-10-22 从 GitHub 取的 sync-upstream.yml 最近 30 次运行。期待值是照着
// GitHub 网页上的运行列表手写的，不是拿 deployState 跑出来的。

const FIX = JSON.parse(
  readFileSync(path.join(ROOT, 'tests/fixtures/deploy-runs-2026-10-22.json'), 'utf8'),
).workflow_runs;
const shaOf = (short) => FIX.find((r) => r.head_sha.startsWith(short)).head_sha;
const runOf = (short) => FIX.find((r) => r.head_sha.startsWith(short));
// 「当时那一刻」GitHub 列表的样子：只留 id 不大于某次运行的，并可改写某几次的状态
const snapshot = (uptoShort, override = {}) =>
  FIX.filter((r) => r.id <= runOf(uptoShort).id).map((r) => {
    const o = override[r.head_sha.slice(0, 7)];
    return o ? { ...r, ...o } : r;
  });

test('真实：普通推送且自己的运行成功 -> live', () => {
  assert.deepEqual(deployState(FIX, shaOf('9e3a2ee')), { state: 'live' });
});

test('真实 10-18：连推几次、前面的被取消，由后面成功的那次一起推上去 -> live', () => {
  // 9baeb61 / e10ca58 / 61da6ad 都是 cancelled，ef76dd9 成功
  for (const s of ['9baeb61', 'e10ca58', '61da6ad']) {
    assert.equal(runOf(s).conclusion, 'cancelled', `夹具变了：${s}`);
    assert.deepEqual(deployState(FIX, shaOf(s)), { state: 'live' }, s);
  }
});

test('真实 10-21：发布的几个提交被取消、posts.json 那次检查没过 -> blocked（下架之前那一刻）', () => {
  // 下架提交 ab308d2 / b48385a 还没出现时的列表
  const runs = snapshot('d99223e');
  for (const s of ['0efd5fa', '1fc4ba7', 'd99223e']) {
    const r = deployState(runs, shaOf(s));
    assert.equal(r.state, 'blocked', s);
    assert.equal(r.runUrl, runOf('d99223e').html_url, '链接要指向没过的那次');
  }
});

test('还在跑的运行优先于已失败的 -> pending（后面那次可能修好了）', () => {
  const runs = snapshot('ab308d2', { ab308d2: { status: 'in_progress', conclusion: null } });
  assert.deepEqual(deployState(runs, shaOf('1fc4ba7')), { state: 'pending' });
});

test('更早的成功运行不算数：自己还在跑时 -> pending，不是 live', () => {
  // b4ac6e9 成功在 0efd5fa 之前；它推上去的版本里没有 0efd5fa
  const runs = snapshot('0efd5fa', { '0efd5fa': { status: 'queued', conclusion: null } });
  assert.equal(runOf('b4ac6e9').conclusion, 'success', '夹具变了');
  assert.deepEqual(deployState(runs, shaOf('0efd5fa')), { state: 'pending' });
});

test('刚推送、GitHub 还没登记运行 -> pending', () => {
  assert.deepEqual(deployState(FIX, 'f'.repeat(40)), { state: 'pending' });
});

test('全部被取消又没有后续运行 -> pending（交给前端超时，不谎报上线或拦下）', () => {
  const runs = snapshot('1fc4ba7');
  assert.equal(runOf('1fc4ba7').conclusion, 'cancelled', '夹具变了');
  assert.deepEqual(deployState(runs, shaOf('1fc4ba7')), { state: 'pending' });
});
