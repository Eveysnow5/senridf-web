const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parseArgs, verdict } = require('../scripts/ai-intel-scraper/probe-model');

// 这个探针存在的理由，见 probe-model.js 顶部：2026-08-25 换模型/加参数失败四次，
// 每次代价都是一整轮部署 + 一次作者点击，而四次里三次一次真实调用就能判掉。
const ROOT = path.join(__dirname, '..');

test('parseArgs：多个模型、以及"不传参数"的对照开关', () => {
  assert.deepEqual(parseArgs(['--model', 'a']), { models: ['a'], thinkingOff: true });
  assert.deepEqual(parseArgs(['--model', 'a', '--model', 'b']), {
    models: ['a', 'b'],
    thinkingOff: true,
  });
  assert.equal(parseArgs(['--model', 'a', '--no-thinking-off']).thinkingOff, false);
  assert.match(parseArgs([]).error, /至少一个/);
  assert.match(parseArgs(['--model']).error, /模型名/);
});

// ★ 这正是 2026-08-25 撞到的那个 400。判据必须认得出它，
// 否则下次还是要靠人读日志才知道"这个模型压根不允许关思考"。
test('★ 模型拒绝 enable_thinking → rejects_flag，不能混进普通错误', () => {
  const v = verdict({
    status: 400,
    providerMessage:
      'HTTP 400 — <400> InternalError.Algo.InvalidParameter: The value of the enable_thinking parameter is restricted to True.',
    thinkingOff: true,
  });
  assert.equal(v.kind, 'rejects_flag');
  assert.match(v.note, /不允许关闭思考|无法避免/);
});

test('其它 4xx/5xx 归为 error，并带上上游原文', () => {
  const v = verdict({ status: 403, providerMessage: 'HTTP 403 — Arrearage', thinkingOff: true });
  assert.equal(v.kind, 'error');
  assert.match(v.note, /403/);
  assert.match(v.note, /Arrearage/, '上游原文要带上 —— 403 有四种，只看状态码分不出来');
});

// 200 但推理仍占大头 = 参数没起作用。这种最阴：不报错、看着成功。
test('接受了参数却仍在产推理 → thinking_on', () => {
  const v = verdict({
    status: 200,
    usage: { completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 92 } },
    thinkingOff: true,
  });
  assert.equal(v.kind, 'thinking_on');
  assert.match(v.note, /92%/);
});

test('推理占比低 → ok', () => {
  const v = verdict({
    status: 200,
    usage: { completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 0 } },
    thinkingOff: true,
  });
  assert.equal(v.kind, 'ok');
});

// 没传参数时本来就该有推理，不该报警 —— 那是对照组。
test('没传 enable_thinking 时，推理占比高是正常的', () => {
  const v = verdict({
    status: 200,
    usage: { completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 92 } },
    thinkingOff: false,
  });
  assert.equal(v.kind, 'ok');
});

test('usage 缺失不抛错（有些错误路径拿不到）', () => {
  assert.doesNotThrow(() => verdict({ status: 200, thinkingOff: true }));
  assert.equal(verdict({ status: 200, thinkingOff: true }).kind, 'ok');
});

// ── 接线 ──────────────────────────────────────────────────────────────────
test('已从全部档位移除只能思考的那个模型', () => {
  const s = readFileSync(path.join(ROOT, 'functions', 'api', '_lib', 'models.js'), 'utf8');
  const tiers = s.slice(s.indexOf('export const TIERS'), s.indexOf('export const TASK_TIER'));
  // 只认**引号里的值**。TIERS 里有一行注释写着"原为 a95b，因无法关闭思考而换掉"，
  // 用 /a95b/ 会被那句注释满足 —— 而它恰恰是该保留的说明。
  // （今天第五次撞到"断言被自己写的注释满足"。）
  assert.doesNotMatch(
    tiers,
    /:\s*'[^']*a95b[^']*'/,
    'qwen3.8-2.4t-a95b 不允许关思考（HTTP 400），在本项目里是纯浪费，不该出现在任何档位',
  );
  // 而"为什么移除"必须留在文件里 —— 只写进提交信息的话，下次选模型的人看不到
  assert.match(s, /restricted to True/, 'models.js 里没留下那条上游报错原文');
});

test('probe workflow 存在，且输入不插进 shell 脚本', () => {
  const wf = readFileSync(path.join(ROOT, '.github', 'workflows', 'probe-model.yml'), 'utf8');
  assert.match(wf, /workflow_dispatch/);
  assert.match(wf, /MODELS: \$\{\{ inputs\.models \}\}/, '输入应走 env');
  assert.doesNotMatch(wf, /node probe-model\.js.*\$\{\{/, '不该把输入插进命令');
});
