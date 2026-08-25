import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Qwen3 在 DashScope 上**默认开启**混合思考模式。开着的代价有两条，都不报错：
//   1. 推理 token **照常计费**，而我们的端点只读 `message.content` / `delta.content`
//      —— 推理内容直接丢弃，等于花钱买了扔掉；
//   2. 响应慢好几倍。2026-08-25 实测：一次 max_tokens=100 的衔接语调用 17.6 秒，
//      而校对（max_tokens 6000）因此超过 30 秒超时，被 Cloudflare 掐成 502。
//
// 两个流式端点在 2026-08 早些时候踩过"卡 20 秒再一次性吐出"的坑、关掉了；
// **四个非流式端点一直漏着**，models.js 里"最便宜的止血"那条待办说的就是它们，
// 而那条待办写下之后没人做——直到额度耗尽换模型，它才以 502 的形式爆出来。
//
// 这条护栏让"新加端点忘了关思考"变成红灯。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'functions', 'api');

/** 所有直接调用 chat-completions 的端点文件。 */
function llmEndpoints() {
  return readdirSync(API_DIR)
    .filter((n) => n.endsWith('.js'))
    .map((n) => ({ name: n, src: readFileSync(path.join(API_DIR, n), 'utf8') }))
    .filter((f) => f.src.includes('CHAT_ENDPOINT'));
}

const ENDPOINTS = llmEndpoints();

// 只认**没被注释掉**的那一行。
// `// enable_thinking: false,` 看起来在、实际不在，而首版断言用 includes 判断，
// 被注释掉的那行照样满足 —— 突变验证实测逃逸过一次。
const LIVE_FLAG = /^(?!\s*(?:\/\/|\*)).*enable_thinking:\s*false/m;

function hasLiveFlag(src) {
  return LIVE_FLAG.test(src);
}

function liveFlagIndex(src) {
  const m = src.match(LIVE_FLAG);
  return m ? m.index : -1;
}

test('护栏自身有效：扫到了调用模型的端点', () => {
  const names = ENDPOINTS.map((f) => f.name).sort();
  assert.ok(ENDPOINTS.length >= 5, `只扫到 ${ENDPOINTS.length} 个：${names.join(', ')}`);
  // 已知的六个里，这几个必须在名单内；漏扫等于护栏失效
  for (const n of ['proofread.js', 'summary.js', 'translate.js', 'lifestory.js']) {
    assert.ok(
      names.includes(n),
      `${n} 没被扫到 —— 它是否还在调 CHAT_ENDPOINT？名单：${names.join(', ')}`,
    );
  }
});

test('每个调模型的端点都显式关掉了思考模式', () => {
  const missing = ENDPOINTS.filter((f) => !hasLiveFlag(f.src)).map((f) => f.name);
  assert.deepEqual(
    missing,
    [],
    `这些端点没关思考模式：推理 token 照常计费却被丢弃，响应还慢好几倍：\n${missing.join('\n')}`,
  );
});

// 只写 `enable_thinking: false` 还不够 —— 它必须在**发给上游的请求体**里，
// 而不是躺在某个没被用到的常量上。这里确认它出现在 JSON.stringify 的范围内。
test('参数真的进了请求体，不是躺在别处', () => {
  for (const { name, src } of ENDPOINTS) {
    const i = liveFlagIndex(src);
    assert.ok(i > 0, `${name} 缺 enable_thinking（或者被注释掉了）`);
    const before = src.slice(0, i);
    const lastStringify = before.lastIndexOf('JSON.stringify({');
    const lastClose = before.lastIndexOf('}),');
    assert.ok(
      lastStringify > lastClose,
      `${name} 的 enable_thinking 不在请求体里（多半在注释或别的对象上）`,
    );
  }
});

// 反向：两个流式端点是**先**关掉的，它们的注释记着当初的症状。
// 这条防止有人"统一风格"时把那段说明删掉——那段是这个参数唯一的来由记录。
test('流式端点保留了当初为什么关思考的说明', () => {
  for (const n of ['translate-stream.js', 'analyze-stream.js']) {
    const src = readFileSync(path.join(API_DIR, n), 'utf8');
    assert.match(src, /thinking/i, `${n} 丢了思考模式的说明`);
  }
});
