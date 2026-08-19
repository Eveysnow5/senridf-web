import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pollMirrorHead } from '../js/shared/deploy-poll.js';

// 这个模块存在的唯一理由，是把三种结局分开。原代码把它们合成了一种：
// `catch { /* 网络抖动 */ }` + 循环结束一句「上线状态未确认」，于是
// CSP 拦截、GitHub 限流、断网、部署慢，在界面上完全一样。
// 下面每条测试守的都是"这两种情况必须能分辨"，不是"函数跑得通"。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const noSleep = async () => {};
const okRes = (sha) => ({ ok: true, json: async () => ({ sha }) });

test('镜像 HEAD 对上本次提交 -> synced，且不再多轮询', async () => {
  let calls = 0;
  const r = await pollMirrorHead({
    url: 'u',
    commitSha: 'abc',
    sleep: noSleep,
    fetchImpl: async () => {
      calls++;
      return okRes(calls >= 3 ? 'abc' : 'old');
    },
  });
  assert.equal(r.state, 'synced');
  assert.equal(r.attempts, 3, '对上之后应立刻返回，不该跑满 15 次');
  assert.equal(calls, 3);
});

test('查得到但一直没同步 -> unconfirmed（部署确实慢，这句提示是对的）', async () => {
  const r = await pollMirrorHead({
    url: 'u',
    commitSha: 'abc',
    sleep: noSleep,
    attempts: 4,
    fetchImpl: async () => okRes('other'),
  });
  assert.equal(r.state, 'unconfirmed');
  assert.equal(r.okResponses, 4, '拿到过 4 次成功响应');
});

test('请求全程抛错（CSP 拦截就长这样）-> unreachable，不是 unconfirmed', async () => {
  const r = await pollMirrorHead({
    url: 'u',
    commitSha: 'abc',
    sleep: noSleep,
    attempts: 3,
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(r.state, 'unreachable', 'CSP 拦截必须与"部署慢"区分开');
  assert.equal(r.okResponses, 0);
  assert.match(r.lastError.message, /Failed to fetch/, '最后一次错误要留下来给作者看');
});

// GitHub 未认证接口 60 次/小时/IP。超限时它返回的是**格式完全正常的 JSON**，
// 只判断"能不能解析"会把限流当成"查到了、只是还没同步"，于是又回到那句
// 无信息的「上线状态未确认」。必须先看状态码。
test('限流的 403 带合法 JSON，仍算 unreachable', async () => {
  let parsed = 0;
  const r = await pollMirrorHead({
    url: 'u',
    commitSha: 'abc',
    sleep: noSleep,
    attempts: 3,
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => {
        parsed++;
        return { message: 'API rate limit exceeded' };
      },
    }),
  });
  assert.equal(r.state, 'unreachable');
  assert.equal(parsed, 0, '状态码不对就不该去解析响应体');
  assert.equal(r.lastError.message, 'HTTP 403');
});

test('先断网后恢复：只要成功过一次，就不是 unreachable', async () => {
  let n = 0;
  const r = await pollMirrorHead({
    url: 'u',
    commitSha: 'abc',
    sleep: noSleep,
    attempts: 4,
    fetchImpl: async () => {
      n++;
      if (n <= 2) throw new Error('net down');
      return okRes('other');
    },
  });
  assert.equal(r.state, 'unconfirmed');
  assert.equal(r.okResponses, 2);
});

test('每次轮询之前都等待（否则会瞬间打满 15 个请求）', async () => {
  const waits = [];
  await pollMirrorHead({
    url: 'u',
    commitSha: 'abc',
    attempts: 3,
    intervalMs: 20000,
    sleep: async (ms) => waits.push(ms),
    fetchImpl: async () => okRes('other'),
  });
  assert.deepEqual(waits, [20000, 20000, 20000]);
});

// 抽成共享模块的意义在于两个 admin 页用的是同一份。哪天有人在页面里
// 复制回一份本地实现，这条会红。
test('两个 admin 页都改用了共享模块，没有各自留一份轮询逻辑', () => {
  for (const f of ['admin/index.html', 'admin/blog/index.html']) {
    const s = readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(
      s,
      /import \{ pollMirrorHead \} from '\/js\/shared\/deploy-poll\.js'/,
      `${f} 没引用共享模块`,
    );
    assert.doesNotMatch(s, /for \(let i = 0; i < 15; i\+\+\)/, `${f} 里还留着本地轮询循环`);
    assert.match(s, /r\.state === 'unreachable'/, `${f} 没有处理 unreachable 这一支`);
  }
});
