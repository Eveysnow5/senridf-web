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

// ⚠️ 2026-08-25 二次扩大：**首版只扫 functions/api/**，于是两个爬虫和 admin Worker
// 全部漏网 —— 当天下午手动跑情报爬虫，判定报错已从 49 降到 1，唯独简报仍然
// 60 秒超时，就是因为爬虫那侧没关思考。
//
// 这条护栏写下时的全部主旨，就是「同一个参数不能只在想得起来的地方设」，
// 而它自己**当天就只覆盖了作者想得起来的那个目录**。所以现在改成扫全仓库，
// 谁调 chat-completions 谁就得守规矩，不管它在哪个目录、跑在哪个平台。
const SKIP_DIRS = new Set(['node_modules', '.git', 'docs', 'tests', 'tools']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(name.name) || name.name.startsWith('__')) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (name.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

/**
 * 所有**真正发出** chat-completions 请求的文件。
 * 排除只导出配置/桥接的那两个（models.js 定义 CHAT_ENDPOINT、
 * model-config.js 只是 CJS→ESM 的桥），它们不发请求，没有请求体可设参数。
 */
function llmCallers() {
  return walk(ROOT)
    .map((p) => ({
      name: path.relative(ROOT, p).split(path.sep).join('/'),
      src: readFileSync(p, 'utf8'),
    }))
    .filter((f) => /CHAT_ENDPOINT|chat\/completions/.test(f.src))
    .filter((f) => /max_tokens/.test(f.src));
}

const ENDPOINTS = llmCallers();

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
  assert.ok(ENDPOINTS.length >= 8, `只扫到 ${ENDPOINTS.length} 个：${names.join(', ')}`);
  // 三个平台各要有代表：Pages Functions / GitHub Actions 爬虫 / Cloudflare Worker。
  // 少了任何一类，就说明扫描范围又缩回去了 —— 首版就是只有第一类。
  for (const n of [
    'functions/api/proofread.js',
    'functions/api/summary.js',
    'functions/api/translate.js',
    'functions/api/lifestory.js',
    'scripts/ai-intel-scraper/index.js',
    'scripts/bid-scraper/index.js',
    'workers/sdf-admin/src/index.js',
  ]) {
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

// 只写 `enable_thinking: false` 还不够 —— 它必须和 `model:` 在**同一个对象字面量**里，
// 也就是真的进了发给上游的请求体，而不是躺在注释或别的对象上。
//
// ⚠️ 首版用 `JSON.stringify({` 的位置来判断，只认 fetch 那种写法 ——
// 两个爬虫用的是 **axios**，请求体是普通对象、根本没有 JSON.stringify，
// 于是正确的代码被判成不合格。**又一次"护栏只认作者当时想到的那一种形态"。**
// 改成数花括号深度，两种写法都覆盖。
function inSameObjectAsModel(src) {
  const start = src.search(/\bmodel:\s*modelFor\(/);
  if (start < 0) return false;
  let depth = 0;
  for (let i = start; i >= 0; i--) {
    if (src[i] === '{') {
      depth = i;
      break;
    }
  }
  let level = 0;
  for (let i = depth; i < src.length; i++) {
    if (src[i] === '{') level++;
    else if (src[i] === '}') {
      level--;
      if (level === 0) return false; // 对象结束了还没见到
    } else if (level === 1 && src.startsWith('enable_thinking: false', i)) {
      // level === 1 表示就在这一层，而不是嵌在里面的子对象里
      return true;
    }
  }
  return false;
}

test('参数真的进了请求体，不是躺在别处', () => {
  for (const { name, src } of ENDPOINTS) {
    const i = liveFlagIndex(src);
    assert.ok(i > 0, `${name} 缺 enable_thinking（或者被注释掉了）`);
    assert.ok(
      inSameObjectAsModel(src),
      `${name} 的 enable_thinking 跟 model: 不在同一个对象里 —— 多半没进请求体`,
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
