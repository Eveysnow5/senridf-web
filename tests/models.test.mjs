// Model selection for DashScope endpoints.
// .mjs: functions/api/_lib/models.js is ESM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CHAT_ENDPOINT, modelFor, TIERS, TASK_TIER } from '../functions/api/_lib/models.js';

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

function sourcesUnderScan() {
  const out = [];
  for (const rel of SCANNED_DIRS) {
    const dir = new URL(rel, import.meta.url);
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      out.push({ label: rel + name, src: readFileSync(new URL(name, dir), 'utf8') });
    }
  }
  return out;
}

test('每个任务都解析出非空模型 id', () => {
  for (const task of TASKS) {
    const id = modelFor(task);
    assert.equal(typeof id, 'string', `${task} 应返回字符串`);
    assert.ok(id.length > 0, `${task} 不应为空`);
  }
});

test('三个 tier 都有值', () => {
  for (const [tier, id] of Object.entries(TIERS)) {
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
    assert.ok(TIERS[tier], `任务 ${task} 指向了不存在的档位 ${tier}`);
  }
});

test('env 覆盖优先于默认 tier', () => {
  const env = { QWEN_MODEL_TRANSLATE_STREAM: 'some-other-model' };
  assert.equal(modelFor('translateStream', env), 'some-other-model');
  // 未设置覆盖的任务不受影响
  assert.equal(modelFor('translate', env), TIERS.strong);
});

test('env 为空对象 / undefined 时回落到默认', () => {
  assert.equal(modelFor('summary', {}), TIERS.balanced);
  assert.equal(modelFor('summary', undefined), TIERS.balanced);
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

// 集中化之后调用方里已经不再出现供应商域名，所以不能拿域名当筛选条件——
// 那样条件永远不成立，测试会空转通过。改成以 CHAT_ENDPOINT 的使用者为准，
// 并断言这个集合非空，避免“没有文件匹配 => 通过”。
test('每个调用大模型的地方都同时用了 CHAT_ENDPOINT 和 modelFor', () => {
  const callers = sourcesUnderScan().filter(({ src }) => src.includes('CHAT_ENDPOINT'));
  const missing = callers.filter(({ src }) => !src.includes('modelFor(')).map(({ label }) => label);
  assert.ok(callers.length >= 9, `只找到 ${callers.length} 个调用方，断言可能已失效`);
  assert.deepEqual(
    missing,
    [],
    `这些地方用了 CHAT_ENDPOINT 但没用 modelFor：${missing.join(', ')}`,
  );
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
  assert.equal(cfg.CHAT_ENDPOINT, CHAT_ENDPOINT, '桥拿到的端点应与直接 import 的一致');
  assert.equal(cfg.modelFor('bidSummary'), TIERS.batch);
  assert.equal(cfg.modelFor('aiIntel'), TIERS.batch);
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
