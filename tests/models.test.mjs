// 全站大模型配置（functions/api/_lib/models.js）：送り先・キー・モデル。2026-10-24 起只有硅基流动。
// .mjs: functions/api/_lib/models.js is ESM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  SF_ENDPOINT,
  SF_TIERS,
  DEMO_PROVIDER,
  chatRoute,
  demoProvider,
  modelFor,
  TASK_TIER,
} from '../functions/api/_lib/models.js';

const TASKS = [
  'translate',
  'translateStream',
  'summary',
  'analyze',
  'proofread',
  'lifestory',
  'bidSummary',
  'aiIntel',
  'adminTranslate',
];

// 被护栏扫描的目录：所有会调用大模型的生产代码。
// 刻意不含 tools/document-analyzer——纯本地独立工具，设计成免安装直接跑、
// 不参与部署，故意不接共享配置（见 docs/TOOLS.md）。
const SCANNED_DIRS = [
  '../functions/api/',
  '../scripts/bid-scraper/',
  '../scripts/ai-intel-scraper/',
  '../workers/sdf-admin/src/',
];

// 唯一的豁免：probe-model.js 的职责就是**探任意模型名**（含还没进 TIERS 的候选），
// 所以它必须接受 --model 传进来的字符串，不能走 modelFor。
// 豁免的前提由下面一条测试钉住，不会静静扩大。
const MODEL_SCAN_EXEMPT = new Set(['../scripts/ai-intel-scraper/probe-model.js']);

function sourcesUnderScan() {
  const out = [];
  for (const rel of SCANNED_DIRS) {
    const dir = new URL(rel, import.meta.url);
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      if (MODEL_SCAN_EXEMPT.has(rel + name)) continue;
      out.push({ label: rel + name, src: readFileSync(new URL(name, dir), 'utf8') });
    }
  }
  return out;
}

// 豁免的前提：它确实是个探针（接受任意模型名、并判断该模型可不可用），
// 而不是一个忘了走 modelFor 的普通调用方。
test('豁免项的前提仍然成立：probe-model.js 确实是探针', () => {
  const src = readFileSync(
    new URL('../scripts/ai-intel-scraper/probe-model.js', import.meta.url),
    'utf8',
  );
  assert.match(src, /--model/, '不再接受任意模型名，就不该豁免');
  assert.match(src, /rejects_flag/, '不再判断模型可用性，豁免失去意义');
  assert.doesNotMatch(src, /model:\s*['"`]qwen/, '探针自己也不该硬编码模型 id');
});

test('每个任务都解析出非空模型 id', () => {
  for (const task of TASKS) {
    const id = modelFor(task);
    assert.equal(typeof id, 'string', `${task} 应返回字符串`);
    assert.ok(id.length > 0, `${task} 不应为空`);
  }
});

test('每个档位都有值', () => {
  for (const [tier, id] of Object.entries(SF_TIERS)) {
    assert.ok(id && id.length > 0, `tier ${tier} 不应为空`);
  }
});

// 守的是「意图」，不是「解析出的 id 互不相同」——配额紧张时多个档位
// 合并到同一个模型是合法的，但任务→档位的映射必须留着，
// 否则以后额度宽裕了没人知道该怎么重新拆开。
test('任务→档位的意图映射保持不变', () => {
  assert.equal(TASK_TIER.proofread, 'strong', '深度语义校对必须留在最强档（2026-07-28 的决策）');
  assert.equal(TASK_TIER.translate, 'strong', '文本翻译+回译需要最强档');
  assert.equal(TASK_TIER.translateStream, 'fast', '实时口译逐句调用，必须留在快档');
  // 每个任务都必须指向一个真实存在的档位
  for (const [task, tier] of Object.entries(TASK_TIER)) {
    assert.ok(SF_TIERS[tier], `任务 ${task} 指向了不存在的档位 ${tier}`);
  }
});

test('env 覆盖优先于默认 tier', () => {
  const env = { QWEN_MODEL_TRANSLATE_STREAM: 'some-other-model' };
  assert.equal(modelFor('translateStream', env), 'some-other-model');
  // 未设置覆盖的任务不受影响
  assert.equal(modelFor('translate', env), SF_TIERS.strong);
});

test('env 为空对象 / undefined 时回落到默认', () => {
  assert.equal(modelFor('summary', {}), SF_TIERS.balanced);
  assert.equal(modelFor('summary', undefined), SF_TIERS.balanced);
});

test('未知任务直接抛错，不静默返回 undefined', () => {
  assert.throws(() => modelFor('nope'), /Unknown model task/);
});

// 回归护栏：模型 id 和端点 URL 曾经硬编码在 8 个地方（6 个 Pages Function
// + 2 个爬虫），配额耗尽时要逐个文件改、极容易漏。以下三条保证没人写回去。
test('生产代码里没有任何硬编码的 qwen 模型 id', () => {
  const offenders = sourcesUnderScan()
    // 只查“把模型名直接写在请求体里”，注释里列候选模型是允许的
    .filter(({ src }) => /model:\s*['"`]/.test(src))
    .map(({ label }) => label);
  assert.deepEqual(offenders, [], `这些文件仍在硬编码 model：${offenders.join(', ')}`);
});

// 2026-10-23 起调用方一律经 chatRoute 取「送り先・キー・モデル」（硅基流动への段階移行）。
// 直接读 CHAT_ENDPOINT 或 QWEN_API_KEY 的调用方会绕过切换——有密钥也不会换过去。
// 以 chatRoute 的使用者为准并断言集合大小，避免「没有文件匹配 => 通过」。
test('每个调用大模型的地方都经 chatRoute，没有直接读端点或 QWEN_API_KEY', () => {
  const sources = sourcesUnderScan();
  const callers = sources.filter(({ src }) => src.includes('chatRoute('));
  assert.ok(callers.length >= 10, `只找到 ${callers.length} 个调用方，断言可能已失效`);
  const bypass = sources
    .filter(({ label }) => !label.endsWith('/_lib/models.js'))
    .filter(({ src }) => /\bCHAT_ENDPOINT\b|env\.QWEN_API_KEY/.test(src))
    .map(({ label }) => label);
  assert.deepEqual(bypass, [], `这些地方绕过了 chatRoute：${bypass.join(', ')}`);
});

// 2026-10-24：隐私政策只列硅基流动。代码里只要还留着百炼的地址或还在读百炼的密钥，
// 密钥被误删/填错时用户内容就可能被发到政策里没写的地方。这里连探针和爬虫共用库一起扫。
test('生产代码不再读百炼的密钥、也不含百炼的地址', () => {
  const extra = [
    '../scripts/ai-intel-scraper/probe-model.js',
    '../scripts/_lib/model-config.js',
    '../scripts/_lib/llm-retry.js',
  ];
  const files = [
    ...sourcesUnderScan(),
    ...extra.map((rel) => ({
      label: rel,
      src: readFileSync(new URL(rel, import.meta.url), 'utf8'),
    })),
  ];
  assert.ok(files.length >= 20, `只扫到 ${files.length} 个文件，护栏可能失效`);
  const hits = files
    .filter(({ src }) => /dashscope\.aliyuncs\.com|env\??\.QWEN_API_KEY/.test(src))
    .map(({ label }) => label);
  assert.deepEqual(hits, [], `这些文件还在用百炼：${hits.join(', ')}`);
});

// 没有密钥时 chatRoute 给空 apiKey；调用方必须**先查再发**，否则会带着空密钥把内容发出去。
test('每个经 chatRoute 的调用方，发请求前都检查了 apiKey', () => {
  const callers = sourcesUnderScan().filter(
    ({ label, src }) => src.includes('chatRoute(') && !label.endsWith('/_lib/models.js'),
  );
  assert.ok(callers.length >= 10, `只找到 ${callers.length} 个调用方，断言可能已失效`);
  const missing = callers
    .filter(({ src }) => !/if \(!(route\.)?apiKey\)/.test(src))
    .map(({ label }) => label);
  assert.deepEqual(missing, [], `这些调用方没先检查密钥：${missing.join(', ')}`);
});

// 供应商迁移（百炼 → 硅基流动）时，URL 必须只有一处需要改。
test('供应商 URL 只出现在 models.js 里', () => {
  const offenders = sourcesUnderScan()
    .filter(({ src }) =>
      /https:\/\/[^\s'"`]*\/(v1|compatible-mode\/v1)\/chat\/completions/.test(src),
    )
    .map(({ label }) => label);
  assert.deepEqual(offenders, [], `这些文件硬编码了 chat/completions URL：${offenders.join(', ')}`);
});

// 爬虫是 CommonJS，共享配置是 ESM，中间靠 scripts/_lib/model-config.js 的
// 动态 import 桥接。这个桥是新机制，而且只在夜间定时任务里跑——坏了不会有人
// 立刻发现，所以这里直接把它加载一遍。
test('CJS → ESM 桥能真的加载到共享配置', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { loadModelConfig } = require('../scripts/_lib/model-config.js');

  const cfg = await loadModelConfig();
  assert.equal(cfg.SF_ENDPOINT, SF_ENDPOINT, '桥拿到的端点应与直接 import 的一致');
  assert.equal(cfg.modelFor('bidSummary'), SF_TIERS.batch);
  assert.equal(cfg.modelFor('aiIntel'), SF_TIERS.batch);
  // 爬虫传的是 process.env，覆盖必须走得通
  assert.equal(cfg.modelFor('aiIntel', { QWEN_MODEL_AI_INTEL: 'x' }), 'x');
  assert.equal(await loadModelConfig(), cfg, '应缓存同一个模块实例');
});

// 注意：括号里原本写「不与交互工具抢同一个额度桶」，2026-08-11 起已不成立——
// batch 现在和 strong 落在同一个模型上（原因见 models.js 的 TIERS 注释：不跨
// 家族的前提下没有别的晚期桶了）。断言本身仍有意义：把爬虫单独归一档，是为了
// 额度宽裕时能一键把它们挪回独立桶，而不必回去翻哪些任务算"夜间批量"。
test('两个爬虫任务都归在 batch 档（保留独立分配的能力）', () => {
  assert.equal(TASK_TIER.bidSummary, 'batch');
  assert.equal(TASK_TIER.aiIntel, 'batch');
});

test('后台批量翻译留在最强档（产出会直接发布到线上）', () => {
  assert.equal(TASK_TIER.adminTranslate, 'strong');
});

// ── 硅基流动（2026-10-23 移行、10-24 百炼への後退を撤去）──
// 期待値は手書き：キーがあれば海外站、無ければ空キー（送らない）。百炼の鍵があっても使わない。

test('chatRoute：SILICONFLOW_API_KEY があれば海外站＋SF_TIERS、キーもそれを使う', () => {
  const r = chatRoute('translate', { SILICONFLOW_API_KEY: 'sf', QWEN_API_KEY: 'qw' });
  assert.deepEqual(r, {
    provider: 'siliconflow',
    endpoint: 'https://api.siliconflow.com/v1/chat/completions',
    apiKey: 'sf',
    model: 'Qwen/Qwen3.8-27B',
  });
  assert.equal(
    chatRoute('translateStream', { SILICONFLOW_API_KEY: 'sf' }).model,
    'Qwen/Qwen3.6-35B-A3B',
  );
});

test('chatRoute：硅基流动のキーが無ければ空キー。百炼の鍵があっても百炼へは行かない', () => {
  const r = chatRoute('summary', { QWEN_API_KEY: 'qw' });
  assert.equal(r.provider, 'siliconflow');
  assert.equal(r.endpoint, SF_ENDPOINT);
  assert.equal(r.apiKey, '');
  assert.equal(r.model, SF_TIERS.balanced);
  assert.equal(
    chatRoute('summary', undefined).apiKey,
    '',
    'env 無し → 空キー（呼び出し側が「未設定」を返す）',
  );
});

test('chatRoute：モデルの env 上書きはどちらの経路でも優先', () => {
  assert.equal(
    chatRoute('summary', { SILICONFLOW_API_KEY: 'sf', QWEN_MODEL_SUMMARY: 'x' }).model,
    'x',
  );
  assert.equal(chatRoute('summary', { QWEN_MODEL_SUMMARY: 'y' }).model, 'y');
  assert.throws(() => chatRoute('nope', {}), /Unknown model task/);
});

test('SF_TIERS は全档位に値があり、送り先は SF_ENDPOINT（海外站）', () => {
  for (const tier of ['strong', 'balanced', 'fast', 'batch', 'vision']) {
    assert.ok(SF_TIERS[tier], `SF_TIERS.${tier} が無い`);
  }
  assert.equal(SF_ENDPOINT, 'https://api.siliconflow.com/v1/chat/completions');
});

test('受発注デモ：専用キーが無くても硅基流动キーがあれば同じ海外站・同じモデルで送る', () => {
  const p = demoProvider({ SILICONFLOW_API_KEY: 'sf', QWEN_API_KEY: 'qw' });
  assert.equal(p.dedicated, true);
  assert.equal(p.apiKey, 'sf');
  assert.equal(p.endpoint, DEMO_PROVIDER.endpoint);
  assert.equal(p.label, DEMO_PROVIDER.label);
  assert.equal(modelFor('demoExtract', { SILICONFLOW_API_KEY: 'sf' }), DEMO_PROVIDER.model);
  // 専用キーが優先
  assert.equal(demoProvider({ DEMO_API_KEY: 'd', SILICONFLOW_API_KEY: 'sf' }).apiKey, 'd');
  // どちらも無ければ停止（百炼の鍵があっても使わない）
  const q = demoProvider({ QWEN_API_KEY: 'qw' });
  assert.equal(q.dedicated, false);
  assert.equal(q.apiKey, '');
  assert.equal(q.endpoint, SF_ENDPOINT);
});
