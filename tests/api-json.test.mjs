import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readApiJson } from '../js/shared/api-json.js';

// 我们的端点在**任何路径上都返回 JSON**，包括出错时。所以非 JSON 响应意味着
// 它不是我们的代码发的（Cloudflare 502 错误页、404 路由页、被中间设备改写）。
// 这两类的处理方式完全不同，混在一起就无从下手。
//
// 2026-08-25 那次 502：界面上只有
// `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`，
// 真实信息（HTTP 502）只在 F12 里，**来回问了四轮才定位**。
// 而这个判据在本仓库里已经被独立发现过两次（analysis.html 的 content-type 判断、
// translation.html 那句 `/* HTML error page */` 注释），**两次都没推广**。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'js', 'shared', 'api-json.js'), 'utf8');

// 模块在**调用时**才读 window.sdfT，所以换掉全局 window 就够了 ——
// 不需要 vm.SourceTextModule（那要 --experimental-vm-modules，而 `npm test`
// 不带这个 flag，测试会在 CI 上挂掉）。
// 同时把 console.error 静音：这个模块故意在非 JSON 时留痕，测试输出不该被它淹。
async function load(sdfT) {
  globalThis.window = sdfT ? { sdfT } : {};
  return { readApiJson };
}

const realError = console.error;
test.before(() => {
  console.error = () => {};
});
test.after(() => {
  console.error = realError;
  delete globalThis.window;
});

function res(status, body) {
  return { status, text: async () => body };
}

test('正常 JSON 原样返回（不判断 res.ok —— 很多端点用 4xx + {error} 表达业务错误）', async () => {
  const { readApiJson } = await load();
  assert.deepEqual(await readApiJson(res(200, '{"result":"ok"}')), { result: 'ok' });
  assert.deepEqual(await readApiJson(res(400, '{"error":"未提供文本"}')), { error: '未提供文本' });
});

test('★ 非 JSON 的 502：错误信息必须点明「不是本站服务返回的」', async () => {
  const { readApiJson } = await load();
  await assert.rejects(
    () => readApiJson(res(502, '<!DOCTYPE html><html>...')),
    (err) => {
      assert.equal(err.status, 502, '状态码要挂在 error 上，供调用方分流');
      assert.match(err.message, /502/, '消息里必须带状态码');
      assert.match(err.message, /不是本站服务/, '必须说清责任方 —— 这正是这次故障最缺的一句');
      assert.doesNotMatch(err.message, /JSON|token/i, '不能再把它说成"解析错误"');
      return true;
    },
  );
});

test('Cloudflare 的纯文本 502 也认（实测响应就是 16 字节 "error code: 502"）', async () => {
  const { readApiJson } = await load();
  await assert.rejects(
    () => readApiJson(res(502, 'error code: 502')),
    (err) => err.status === 502 && /502/.test(err.message),
  );
});

test('404 与其它状态给不同的说法（原因不同，该做的事也不同）', async () => {
  const { readApiJson } = await load();
  const grab = async (status) => {
    try {
      await readApiJson(res(status, '<html></html>'));
    } catch (e) {
      return e.message;
    }
    throw new Error('应当抛错');
  };
  const [m502, m404, m418] = [await grab(502), await grab(404), await grab(418)];
  assert.equal(new Set([m502, m404, m418]).size, 3, '三种状态不该共用一句话');
  assert.match(m404, /接口地址不存在|路由/);
});

// 原文开头要留给控制台：Cloudflare 的错误页里常带 Error 1101/1102 或 Ray ID，
// 那是让同事在她自己后台定位这次请求的唯一凭据。
test('保留响应原文开头，供进一步定位', async () => {
  const { readApiJson } = await load();
  const body = '<!DOCTYPE html><title>Error 1102 Worker exceeded resource limits</title>';
  try {
    await readApiJson(res(502, body));
    throw new Error('应当抛错');
  } catch (err) {
    assert.match(err.rawHead, /1102/, '原文开头丢了，错误码就没了');
    assert.ok(err.rawHead.length <= 200, '要截断，否则整页 HTML 会淹掉控制台');
  }
});

test('main.js 没加载时回落中文，不让错误消息本身消失', async () => {
  const { readApiJson } = await load(); // 沙箱里没有 window.sdfT
  try {
    await readApiJson(res(502, 'x'));
  } catch (err) {
    assert.ok(err.message.length > 10, `回落文案为空：${err.message}`);
    assert.match(err.message, /502/);
  }
});

test('有 sdfT 时走 T（切语言后错误消息也要跟着变）', async () => {
  const { readApiJson } = await load((k, fb) => (k === 'api_bad_gateway' ? 'JA {status}' : fb));
  try {
    await readApiJson(res(502, 'x'));
  } catch (err) {
    assert.equal(err.message, 'JA 502', '没有走 T，或者没替换 {status}');
  }
});

// ── 接线 ──────────────────────────────────────────────────────────────────
// 逻辑对了但页面没用上，等于没做。
const PAGES = ['proofreader', 'lifestory', 'translation'];

test('工具页不再直接 res.json() 读 /api 响应', () => {
  const bad = [];
  for (const p of PAGES) {
    const s = readFileSync(path.join(ROOT, 'solutions', 'demo', `${p}.html`), 'utf8');
    s.split('\n').forEach((line, i) => {
      if (/await\s+res(ponse)?\.json\(\)/.test(line) && !/\/\//.test(line.trim().slice(0, 2))) {
        bad.push(`${p}.html:${i + 1}  ${line.trim().slice(0, 70)}`);
      }
    });
  }
  assert.deepEqual(bad, [], `这些地方非 JSON 响应会报成"解析错误"：\n${bad.join('\n')}`);
});

// ⚠️ 2026-08-25 当场踩到：lifestory 和 translation 的主逻辑是**普通** <script>，
// 拿不到 ESM 的 import —— 直接写 readApiJson(res) 会 ReferenceError。
// 必须由 module 块挂到 window 上再桥接。这跟博客分类那次的 race 是同一类问题。
test('普通 script 里用到 readApiJson 的页面，必须有 window 桥接', () => {
  for (const p of PAGES) {
    const s = readFileSync(path.join(ROOT, 'solutions', 'demo', `${p}.html`), 'utf8');
    if (!s.includes('readApiJson')) continue;
    // 找主逻辑所在的块：普通 script（无 type=module）里有没有用到它
    const classic = [
      ...s.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=)[^>]*>([\s\S]*?)<\/script>/g),
    ];
    const usedInClassic = classic.some((m) => /readApiJson\(/.test(m[1]));
    if (!usedInClassic) continue;
    assert.match(
      s,
      /window\.sdfReadApiJson = readApiJson/,
      `${p}.html 的普通 script 用了 readApiJson，但没有把它挂到 window 上`,
    );
    assert.match(
      s,
      /const readApiJson = \(res\) => window\.sdfReadApiJson\(res\)/,
      `${p}.html 缺少普通 script 一侧的桥接`,
    );
  }
});

test('三语文案齐全（错误消息本身漏翻就又变成看不懂的东西）', () => {
  const main = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  for (const key of ['api_bad_gateway', 'api_not_found', 'api_not_json']) {
    const n = (main.match(new RegExp(`${key}:`, 'g')) || []).length;
    assert.equal(n, 3, `${key} 在 T 里出现 ${n} 次（应为三语各一次）`);
  }
  assert.ok(SRC.includes('{status}'), '模块里没有 {status} 占位符');
});
