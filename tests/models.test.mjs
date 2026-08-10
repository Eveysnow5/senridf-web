// Model selection for DashScope endpoints.
// .mjs: functions/api/_lib/models.js is ESM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { modelFor, TIERS, TASK_TIER } from '../functions/api/_lib/models.js';

const TASKS = ['translate', 'translateStream', 'summary', 'analyze', 'proofread', 'lifestory'];

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

// 回归护栏：模型 id 曾经硬编码在 6 个端点里，配额耗尽时要逐个文件改、
// 容易漏。这条测试保证没人把它重新写回去。
test('functions/api 下没有任何硬编码的 qwen 模型 id', () => {
  const dir = new URL('../functions/api/', import.meta.url);
  const offenders = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.js')) continue;
    const src = readFileSync(new URL(name, dir), 'utf8');
    // 只查“把模型名直接写在请求体里”，注释里列候选模型是允许的
    if (/model:\s*['"`]/.test(src)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `这些文件仍在硬编码 model：${offenders.join(', ')}`);
});

// 集中化之后端点里已经不再出现供应商域名，所以不能再拿域名当筛选条件——
// 那样条件永远不成立，测试会空转通过。改成以 CHAT_ENDPOINT 的使用者为准，
// 并断言这个集合非空，避免"没有文件匹配 => 通过"。
test('每个调用大模型的端点都同时用了 CHAT_ENDPOINT 和 modelFor', () => {
  const dir = new URL('../functions/api/', import.meta.url);
  const callers = [];
  const missing = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.js')) continue;
    const src = readFileSync(new URL(name, dir), 'utf8');
    if (!src.includes('CHAT_ENDPOINT')) continue;
    callers.push(name);
    if (!src.includes('modelFor(')) missing.push(name);
  }
  assert.ok(callers.length >= 6, `只找到 ${callers.length} 个调用方，断言可能已失效`);
  assert.deepEqual(
    missing,
    [],
    `这些端点用了 CHAT_ENDPOINT 但没用 modelFor：${missing.join(', ')}`,
  );
});

// 供应商迁移（百炼 → 硅基流动）时，URL 必须只有一处需要改。
test('供应商 URL 只出现在 models.js 里', () => {
  const dir = new URL('../functions/api/', import.meta.url);
  const offenders = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.js')) continue;
    const src = readFileSync(new URL(name, dir), 'utf8');
    if (/https:\/\/[^\s'"`]*\/(v1|compatible-mode\/v1)\/chat\/completions/.test(src)) {
      offenders.push(name);
    }
  }
  assert.deepEqual(offenders, [], `这些文件硬编码了 chat/completions URL：${offenders.join(', ')}`);
});
