const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parseArgs, verdict, expiryVerdict } = require('../scripts/ai-intel-scraper/probe-model');

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

// ── 定时哨兵（2026-09-04）────────────────────────────────────────────────────
// 起因：2026-08-24 免费桶用尽，全站八个功能同时 403，而 Actions 连报四周 success。
// 哨兵查两件**互不替代**的事：模型能不能答 + 额度还剩几天。
// 桶空了模型照样存在，只查前者永远是绿的。
test('★ --from-tiers：模型名从 TIERS 现取，不许写死在 workflow 里', () => {
  const a = parseArgs(['--from-tiers']);
  assert.equal(a.error, undefined, '--from-tiers 不给 --model 也该合法');
  assert.equal(a.fromTiers, true);
  assert.deepEqual(a.models, [], '--from-tiers 时模型名由运行期从 TIERS 取');
});

test('★ 额度到期检查：过期 / 临近 / 还早 要分得开', () => {
  const now = new Date('2026-09-04T00:00:00Z');
  assert.equal(expiryVerdict('m', '2026-08-24', now).kind, 'expired', '已过期没被判出来');
  assert.equal(expiryVerdict('m', '2026-09-20', now).kind, 'soon', '只剩 16 天该报警');
  assert.equal(expiryVerdict('m', '2026-11-18', now).kind, 'ok', '还有 75 天不该报警');
  // 边界：默认 21 天。恰好 21 天要报，22 天不报 —— 循环边界是最常出错的地方
  assert.equal(expiryVerdict('m', '2026-09-25', now).kind, 'soon', '第 21 天该报');
  assert.equal(expiryVerdict('m', '2026-09-26', now).kind, 'ok', '第 22 天不该报');
  // 报警文案里必须有剩余天数：只说"快到期了"，人还得自己去算轻重缓急
  assert.match(expiryVerdict('m', '2026-09-20', now).note, /16 天/);
});

test('★ 到期日缺失本身就要报 —— 静静地不报警是最坏的失败方式', () => {
  const now = new Date('2026-09-04T00:00:00Z');
  assert.equal(expiryVerdict('m', undefined, now).kind, 'unknown');
  assert.equal(expiryVerdict('m', '', now).kind, 'unknown');
  assert.equal(expiryVerdict('m', '不是日期', now).kind, 'unknown', '解析不了也要报');
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

// ★ 哨兵最容易腐烂的一处：TIERS 换了模型，却忘了登记它的到期日。
//   那样哨兵会**安安静静地不报警** —— 和没有哨兵的区别只有一行绿字。
test('★ TIERS 里的每个模型都必须登记到期日', async () => {
  const { pathToFileURL } = require('node:url');
  const abs = path.join(ROOT, 'functions', 'api', '_lib', 'models.js');
  const { TIERS, TIER_EXPIRY } = await import(pathToFileURL(abs).href);

  const models = [...new Set(Object.values(TIERS))];
  assert.ok(models.length > 0, '护栏自身有效：TIERS 里得有模型');
  for (const m of models) {
    assert.ok(TIER_EXPIRY[m], `${m} 在 TIERS 里但 TIER_EXPIRY 里没有 —— 哨兵查不到它，会静默放行`);
    assert.match(TIER_EXPIRY[m], /^\d{4}-\d{2}-\d{2}$/, `${m} 的到期日格式不对：${TIER_EXPIRY[m]}`);
  }
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
  assert.match(wf, /--from-tiers/, '定时触发时没有从 TIERS 取模型');
  assert.doesNotMatch(
    wf,
    /--model\s+qwen/,
    '不许在 workflow 里写死模型名 —— 改 TIERS 后哨兵会一直绿着，绿的却是没人用的模型',
  );
});
