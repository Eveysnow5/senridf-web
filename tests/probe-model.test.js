const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parseArgs, verdict } = require('../scripts/ai-intel-scraper/probe-model');

// 这个探针存在的理由，见 probe-model.js 顶部：2026-08-25 换模型/加参数失败四次，
// 每次代价都是一整轮部署 + 一次作者点击，而四次里三次一次真实调用就能判掉。
const ROOT = path.join(__dirname, '..');

test('parseArgs：多个模型、以及"不传参数"的对照开关', () => {
  assert.deepEqual(parseArgs(['--model', 'a']), {
    models: ['a'],
    thinkingOff: true,
    fromTiers: false,
  });
  assert.deepEqual(parseArgs(['--model', 'a', '--model', 'b']), {
    models: ['a', 'b'],
    thinkingOff: true,
    fromTiers: false,
  });
  assert.equal(parseArgs(['--model', 'a', '--no-thinking-off']).thinkingOff, false);
  assert.match(parseArgs([]).error, /至少一个/);
  assert.match(parseArgs(['--model']).error, /模型名/);
});

// ── 定时哨兵（2026-09-04；2026-10-24 改探硅基流动，删了免费额度到期检查）──────────
// 起因：2026-08-24 免费桶用尽，全站八个功能同时 403，而 Actions 连报四周 success。
// 现在付费、没有到期日；哨兵防的是硅基流动下架/改名了我们用的模型。
test('★ --from-tiers：模型名从 SF_TIERS 现取，不许写死在 workflow 里', () => {
  const a = parseArgs(['--from-tiers']);
  assert.equal(a.error, undefined, '--from-tiers 不给 --model 也该合法');
  assert.equal(a.fromTiers, true);
  assert.deepEqual(a.models, [], '--from-tiers 时模型名由运行期从 SF_TIERS 取');
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
  const tiers = s.slice(s.indexOf('export const SF_TIERS'), s.indexOf('export function chatRoute'));
  assert.ok(tiers.length > 50, '没切到 SF_TIERS，断言会空过');
  // 只认**引号里的值**。文件里有注释提到 a95b（为什么不许用），
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

// ★ 接线：探针读的是硅基流动的端点・模型表・密钥，workflow 传的也是那把密钥。
//   接错的话哨兵会一直红（告警疲劳）或探一个没人用的地方。
test('★ 探针探的是硅基流动（SF_ENDPOINT・SF_TIERS・SILICONFLOW_API_KEY）', () => {
  const src = readFileSync(
    path.join(ROOT, 'scripts', 'ai-intel-scraper', 'probe-model.js'),
    'utf8',
  );
  assert.match(src, /SF_ENDPOINT/);
  assert.match(src, /SF_TIERS/);
  assert.match(src, /process\.env\.SILICONFLOW_API_KEY/);
  assert.doesNotMatch(src, /QWEN_API_KEY|CHAT_ENDPOINT|TIER_EXPIRY/);
  const wf = readFileSync(path.join(ROOT, '.github', 'workflows', 'probe-model.yml'), 'utf8');
  assert.match(wf, /SILICONFLOW_API_KEY: \$\{\{ secrets\.SILICONFLOW_API_KEY \}\}/);
  assert.doesNotMatch(wf, /QWEN_API_KEY:/);
});

// 定时是刻意加的（08-24 静默停服四周），所以要有一条断言把这个意图钉住 ——
// 否则后人看到"LLM workflow 有 schedule"会以为是误加的，顺手删掉。
test('★ 哨兵必须是定时的，失败必须开 issue', () => {
  const wf = readFileSync(path.join(ROOT, '.github', 'workflows', 'probe-model.yml'), 'utf8');
  assert.match(wf, /^\s*schedule:/m, '哨兵没有定时 —— 只能手动点的探针挡不住静默停服');
  assert.match(wf, /cron:/, '缺 cron');
  assert.match(wf, /issues: write/, '缺开 issue 的权限');
  assert.match(wf, /if: failure\(\)/, '失败时没有任何动作 —— 红了也没人看，08-24 就是这么过去的');
  assert.match(wf, /issues\.create/, '没有开 issue 的调用');
  // 追评论而不是每周堆新 issue：告警疲劳会让真正出事那周被忽略
  assert.match(wf, /createComment/, '重复报警没有合并，会堆出一堆同名 issue');
  // 定时触发时不给模型名，必须落到 --from-tiers；写死模型名的话改了 TIERS 哨兵就哑了
  assert.match(wf, /--from-tiers/, '定时触发时没有从 SF_TIERS 取模型');
  assert.doesNotMatch(
    wf,
    /--model\s+qwen/i,
    '不许在 workflow 里写死模型名 —— 改 TIERS 后哨兵会一直绿着，绿的却是没人用的模型',
  );
});
