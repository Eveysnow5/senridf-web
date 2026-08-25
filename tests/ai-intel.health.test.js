const test = require('node:test');
const assert = require('node:assert');
const { runHealth, LLM_ERROR_RATIO_LIMIT } = require('../scripts/ai-intel-scraper/health');

// 这套测试的样本是**真实发生过的四轮**（GitHub Actions 日志，2026-W31~W34），
// 不是我编的夹具。合成夹具总比现实干净一号，而这条护栏要挡的恰恰是
// "现实里那种一半成功一半失败的中间状态"。
//
// 四轮里有三轮是坏的，而 GitHub Actions **每一轮都报了 success**。
const REAL_RUNS = {
  'W31 (08-02) 正常': {
    input: { ingested: 43, filtered: 84, llmErrors: 0, digestAttempted: true, digestWritten: true },
    healthy: true,
  },
  'W32 (08-09) 103 次 403，一条都没入库': {
    input: {
      ingested: 0,
      filtered: 0,
      llmErrors: 103,
      digestAttempted: false,
      digestWritten: false,
    },
    healthy: false,
  },
  'W33 (08-16) 入库正常但简报 60 秒超时': {
    input: {
      ingested: 15,
      filtered: 67,
      llmErrors: 4,
      digestAttempted: true,
      digestWritten: false,
    },
    healthy: false,
  },
  'W34 (08-23) 49 次 403，简报 403': {
    input: {
      ingested: 19,
      filtered: 38,
      llmErrors: 49,
      digestAttempted: true,
      digestWritten: false,
    },
    healthy: false,
  },
};

test('四轮真实历史：只有 W31 算健康', () => {
  for (const [name, { input, healthy }] of Object.entries(REAL_RUNS)) {
    const r = runHealth(input);
    assert.equal(
      r.ok,
      healthy,
      `${name} 判成了 ${r.ok ? 'healthy' : 'unhealthy'}：${r.reasons.join('；')}`,
    );
  }
});

test('W32 是靠"报错占比"抓到的，不是靠简报——那轮压根没尝试生成简报', () => {
  const r = runHealth(REAL_RUNS['W32 (08-09) 103 次 403，一条都没入库'].input);
  assert.ok(
    r.reasons.some((x) => x.includes('判定失败占比')),
    `W32 应由占比规则抓到，实际原因：${r.reasons.join('；')}`,
  );
});

test('W33 是靠"简报没生成"抓到的——它的报错占比只有 4.6%，很正常', () => {
  const input = REAL_RUNS['W33 (08-16) 入库正常但简报 60 秒超时'].input;
  const r = runHealth(input);
  assert.deepEqual(
    r.reasons.filter((x) => x.includes('判定失败占比')),
    [],
    'W33 的报错占比不该被判成异常',
  );
  assert.ok(
    r.reasons.some((x) => x.includes('简报')),
    `实际原因：${r.reasons.join('；')}`,
  );
});

// filtered 是**判定的结论**（这条与我们无关），不是失败。
// 把它当失败的话，正常轮次会被大量误报 —— W31 就滤掉了 84 条。
test('滤掉大量无关条目是正常的，不算不健康', () => {
  const r = runHealth({
    ingested: 2,
    filtered: 200,
    llmErrors: 0,
    digestAttempted: true,
    digestWritten: true,
  });
  assert.ok(r.ok, `被误判成不健康：${r.reasons.join('；')}`);
});

test('没有新增所以没生成简报，本身不算失败（那一周确实没内容）', () => {
  const r = runHealth({
    ingested: 0,
    filtered: 50,
    llmErrors: 0,
    digestAttempted: false,
    digestWritten: false,
  });
  assert.ok(r.ok, `被误判成不健康：${r.reasons.join('；')}`);
});

test('一条候选都没处理 —— 即使不报错也不算成功轮次', () => {
  const r = runHealth({ ingested: 0, filtered: 0, llmErrors: 0 });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('一条候选都没有处理')));
});

test('阈值边界：刚好等于上限算正常，超过才算异常', () => {
  const at = runHealth({ ingested: 7, filtered: 0, llmErrors: 3, digestAttempted: false });
  assert.equal(3 / 10, LLM_ERROR_RATIO_LIMIT, '这条测试假定上限是 0.3，改了阈值要跟着改');
  assert.ok(at.ok, '恰好等于上限不该报警');

  const over = runHealth({ ingested: 6, filtered: 0, llmErrors: 4, digestAttempted: false });
  assert.equal(over.ok, false, '超过上限必须报警');
});

test('缺字段不抛错（运行报告里的计数偶尔会缺）', () => {
  assert.doesNotThrow(() => runHealth());
  assert.doesNotThrow(() => runHealth({}));
  assert.equal(runHealth().ok, false, '什么都没有时应判为不健康，而不是默默通过');
});

// 护栏的护栏：不健康时必须给出**能行动的原因**，只返回 false 等于没说。
test('每个不健康的判定都带原因', () => {
  for (const [name, { input, healthy }] of Object.entries(REAL_RUNS)) {
    if (healthy) continue;
    const r = runHealth(input);
    assert.ok(r.reasons.length > 0, `${name} 判成不健康却没给原因`);
    for (const reason of r.reasons) assert.ok(reason.length > 8, `原因太短：${reason}`);
  }
});

// 接线：逻辑对了但没接上，等于没做。这两条盯的是"退出码真的会变红"。
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');

test('爬虫真的调用了健康判定，并据此决定退出码', () => {
  const s = readFileSync(path.join(ROOT, 'scripts', 'ai-intel-scraper', 'index.js'), 'utf8');
  assert.match(s, /runHealth\(\{/, '没有调用 runHealth');
  assert.match(s, /digestAttempted/, '没有把"是否尝试过简报"传进去');
  assert.match(s, /return health;/, 'main 没有把健康度返回给调用方');
  // ★ 关键：不健康必须以非 0 退出，否则 Actions 还是绿的，跟改之前没区别
  assert.match(s, /if \(health && !health\.ok\) process\.exit\(1\)/, '不健康时没有让进程失败');
});

test('两个爬虫的 LLM 错误都记响应体（403 有四种，只看状态码分不出来）', () => {
  for (const f of ['ai-intel-scraper', 'bid-scraper']) {
    const s = readFileSync(path.join(ROOT, 'scripts', f, 'index.js'), 'utf8');
    assert.match(s, /describeCallError/, `${f} 没有引用 describeCallError`);
    // 报错日志里不该再出现裸的 err.message —— 那正是丢掉诊断线索的写法。
    //
    // ⚠️ 按**整行**判断，不要拿正则的匹配片段去过滤：首版正则从 `failed` 起匹，
    // m[0] 里压根没有 "Judge" 这个词，于是 /Judge|Digest|Translat/ 把它全滤掉、
    // 断言空转通过 —— 突变验证实测逃逸过一次。
    const bad = s
      .split('\n')
      .filter((line) => /Judge|Digest|Translat/.test(line) && /\$\{err\.message\}/.test(line))
      .map((line) => line.trim());
    assert.deepEqual(bad, [], `${f} 的 LLM 错误日志仍在用裸 err.message：\n${bad.join('\n')}`);
  }
});
