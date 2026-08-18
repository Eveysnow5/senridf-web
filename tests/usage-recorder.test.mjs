import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usageDocName, usageFieldTransforms } from '../functions/api/_lib/usageRecorder.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'functions', 'api');

// ⚠️ rateLimiter 曾因为把完整 URL 当成资源名传进 transform.document，
// 被 `if (!res.ok)` 静默吞掉，限流整整六周没生效。这条钉住同一个坑。
test('文档名是**资源名**（projects/… 开头），不是 https URL', () => {
  const n = usageDocName(new Date('2026-08-18T09:00:00Z'));
  assert.ok(n.startsWith('projects/'), `必须是资源名：${n}`);
  assert.doesNotMatch(n, /^https?:/);
  assert.match(n, /\/llm_usage\/2026-08-18$/);
});

test('按天分桶，跨天换文档', () => {
  const a = usageDocName(new Date('2026-08-18T23:59:00Z'));
  const b = usageDocName(new Date('2026-08-19T00:01:00Z'));
  assert.notEqual(a, b);
});

test('正常 usage：总量与分端点都被计入', () => {
  const t = usageFieldTransforms('translate', {
    prompt_tokens: 100,
    completion_tokens: 40,
    total_tokens: 140,
  });
  const byPath = Object.fromEntries(t.map((x) => [x.fieldPath, x.increment.integerValue]));
  assert.equal(byPath.calls, '1');
  assert.equal(byPath.total_tokens, '140');
  assert.equal(byPath['by_task.translate.calls'], '1');
  assert.equal(byPath['by_task.translate.total_tokens'], '140');
  assert.equal(byPath.missing_usage, undefined, '有 usage 时不该记 missing');
});

// 这条是本次改动的核心目的之一：搞清思考模式到底开没开、烧了多少。
test('推理 token 与缓存命中被单独记下', () => {
  const t = usageFieldTransforms('proofread', {
    prompt_tokens: 500,
    completion_tokens: 400,
    total_tokens: 900,
    completion_tokens_details: { reasoning_tokens: 350 },
    prompt_tokens_details: { cached_tokens: 128 },
  });
  const byPath = Object.fromEntries(t.map((x) => [x.fieldPath, x.increment.integerValue]));
  assert.equal(byPath.reasoning_tokens, '350');
  assert.equal(byPath['by_task.proofread.reasoning_tokens'], '350');
  assert.equal(byPath.cached_tokens, '128');
});

// "没量到"和"量到 0"必须分得开，否则观测盲区会被报成"没有消耗"。
test('拿不到 usage 时记 missing_usage，而不是记 0', () => {
  for (const bad of [null, undefined, 'nope']) {
    const t = usageFieldTransforms('analyze', bad);
    const byPath = Object.fromEntries(t.map((x) => [x.fieldPath, x.increment.integerValue]));
    assert.equal(byPath.calls, '1', '调用次数仍要计');
    assert.equal(byPath.missing_usage, '1');
    assert.equal(byPath.total_tokens, undefined, '不该凭空记一个 0 token');
  }
});

test('缺 total_tokens 时用 prompt+completion 兜底；脏字段不污染', () => {
  const a = Object.fromEntries(
    usageFieldTransforms('summary', { prompt_tokens: 40, completion_tokens: 60 }).map((x) => [
      x.fieldPath,
      x.increment.integerValue,
    ]),
  );
  assert.equal(a.total_tokens, '100');
  const b = Object.fromEntries(
    usageFieldTransforms('summary', { prompt_tokens: 'abc', total_tokens: NaN }).map((x) => [
      x.fieldPath,
      x.increment.integerValue,
    ]),
  );
  assert.equal(b.total_tokens, '0');
});

test('increment 值必须是字符串（Firestore integerValue 的要求）', () => {
  for (const x of usageFieldTransforms('translate', { total_tokens: 10 })) {
    assert.equal(typeof x.increment.integerValue, 'string', x.fieldPath);
  }
});

/* ── 接线护栏 ───────────────────────────────────────────────────────────── */

test('六个端点全部接上了用量记录（漏一个就有一块消耗看不见）', () => {
  const endpoints = readdirSync(API).filter((f) => f.endsWith('.js') && f !== '_middleware.js');
  const llm = endpoints.filter((f) => {
    const s = readFileSync(path.join(API, f), 'utf8');
    return s.includes('CHAT_ENDPOINT') || s.includes('modelFor');
  });
  assert.ok(llm.length >= 6, `只识别出 ${llm.length} 个 LLM 端点，护栏可能失效`);
  // ⚠️ 不能只查 'recordUsage' 出现过：import 那一行就满足了，把调用删掉也照样绿
  //    （突变验证当场抓到这一点）。必须查**真的调用**。
  const missing = llm.filter(
    (f) => !/recordUsage\(\{/.test(readFileSync(path.join(API, f), 'utf8')),
  );
  assert.deepEqual(missing, [], `这些 LLM 端点没接用量记录：${missing.join(', ')}`);
});

test('中间件把 idToken 传下去了（没有它就写不进 Firestore）', () => {
  const s = readFileSync(path.join(API, '_middleware.js'), 'utf8');
  assert.match(s, /context\.data\.idToken = token;/);
});

test('记录是 fail-open 但不静默：写失败要在控制台留痕', () => {
  const s = readFileSync(path.join(API, '_lib', 'usageRecorder.js'), 'utf8');
  // ⚠️ 同上：只查 console.error 出现过是不够的，catch 里那一处就满足了。
  //    两条失败路径（HTTP 非 2xx / 抛异常）都必须各自留痕。
  assert.match(s, /if \(!res\.ok\) console\.error/, 'HTTP 非 2xx 时必须留痕');
  assert.match(s, /\.catch\(\(err\) => console\.error/, '抛异常时必须留痕');
  assert.match(s, /waitUntil/, '要用 waitUntil 异步发出，不给主流程加延迟');
});
