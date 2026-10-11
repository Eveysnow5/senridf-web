import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 2026-10-11：线上的月结引擎一点「执行结账」就报 "Classic web workers are not supported"。
// 这一版 Pyodide 不支持经典 Worker，加载器靠「importScripts('data:…') 能不能成功」来判断。
// CSP 强制拦截时那一句被拦下，经典 Worker 碰巧能跑；线上 CSP 是 Report-Only，不拦，于是抛错。
// 此前的浏览器实测全在「强制拦截」的预览环境里做——测试环境比线上严，把错盖住了。
// 这里钉住三件事：页面用 module Worker 起、Worker 里不用 importScripts、加载器是 ES 模块版且与清单一致。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = path.join(ROOT, 'solutions', 'demo');
const html = readFileSync(path.join(DEMO, 'closing.html'), 'utf8');
const worker = readFileSync(path.join(DEMO, 'closing-worker.js'), 'utf8');
const manifest = JSON.parse(
  readFileSync(path.join(DEMO, 'closing-engine', 'manifest.json'), 'utf8'),
);

// new Worker('closing-worker.js?v=2', { type: 'module' }) —— 取出第二个参数（没有就是空串）
const CALLS = [...html.matchAll(/new Worker\('closing-worker\.js(?:\?v=\w+)?'([^)]*)\)/g)].map(
  (m) => m[1],
);

test('护栏自身有效：页面里确实在起这个 Worker', () => {
  assert.ok(CALLS.length >= 1, '找不到 new Worker(closing-worker.js)');
});

test('月结引擎的 Worker 用 module 方式起（经典 Worker 在线上会被 Pyodide 拒绝）', () => {
  for (const c of CALLS)
    assert.match(c, /type:\s*'module'/, `new Worker('closing-worker.js'${c}) 没有 type: 'module'`);
});

test('Worker 里不调用 importScripts（module Worker 里没有它）', () => {
  const code = worker.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\bimportScripts\s*\(/.test(code), 'closing-worker.js 里还有 importScripts(');
  assert.match(code, /await import\(/, 'closing-worker.js 没有用 import() 读加载器');
});

test('加载器是 ES 模块版，文件在、且与清单的 sha256 一致', () => {
  assert.match(
    manifest.loader.name,
    /\.mjs$/,
    `加载器是 ${manifest.loader.name}，应为 pyodide.mjs`,
  );
  const p = path.join(DEMO, 'closing-engine', manifest.loader.name);
  assert.ok(existsSync(p), `${manifest.loader.name} 不存在`);
  assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'), manifest.loader.sha256);
  assert.ok(
    !existsSync(path.join(DEMO, 'closing-engine', 'pyodide.js')),
    '旧的经典版 pyodide.js 还在',
  );
});
