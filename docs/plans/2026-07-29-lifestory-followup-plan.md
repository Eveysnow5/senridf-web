# 人生故事 · 访谈智能（AI 自适应追问）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 AI 当场生成"顺着受访者回答的追问"取代预写的 BRANCHES，逼细节、顺带澄清、尊重回避、老人友好、克制taste。

**Architecture:** 端点新增 `probe` action，一次调用完成"分析 + 生成追问或换题"，返回 `{analysis, followup}`；提示词与 LLM 输出解析抽成服务端纯函数，追问深度决策抽成客户端纯函数；lifestory.html 退役 BRANCHES、改调 probe、加深挖循环（每锚点最多 2 句）。

**Tech Stack:** Cloudflare Pages Functions、Qwen qwen-plus、`node:test`。纯静态零构建。

**部署说明：** 镜像坏着，线上人工验证挂账。本地闸门 `npm run check`。lifestory.html 结构：普通 `<script>`（约 270 行起，全部应用逻辑）+ 底部 `<script type="module">`（约 1029 行，firebase/auth）——纯 ESM 模块需在 module 块 import 后经 `window` 桥接给普通块用（参照 analysis.html 的 `window.sdfSheetToMarkdown`）。lifestory.html **不是** Tailwind content 页（用自有 CSS，不在 `tailwind.config.js` content 列表），无需 `build:css`。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `functions/api/_lib/lifestory-probe.js` | 新建 | 服务端纯函数：`buildProbePrompt`（拼提示词）、`parseProbeJson`（解析 LLM 输出→{analysis,followup}） |
| `tests/lifestory-probe.test.mjs` | 新建 | 上面的单测 |
| `js/shared/lifestory-flow.js` | 新建 | 客户端纯函数：`decideProbe`（追问/换题决策） |
| `tests/lifestory-flow.test.mjs` | 新建 | 上面的单测 |
| `functions/api/lifestory.js` | 改 | 加 `probe` action；`analyze` 原样保留 |
| `solutions/demo/lifestory.html` | 改 | 删 BRANCHES + 标签选题；改调 probe；深挖循环 + CAP；window 桥接 decideProbe |
| `docs/TOOLS.md` | 改 | 记录 AI 自适应追问 |

---

## Task 1: 服务端纯函数 lifestory-probe.js（TDD）

**Files:**
- Create: `functions/api/_lib/lifestory-probe.js`
- Test: `tests/lifestory-probe.test.mjs`

- [ ] **Step 1: 写失败测试** — 创建 `tests/lifestory-probe.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProbePrompt, parseProbeJson } from '../functions/api/_lib/lifestory-probe.js';

test('buildProbePrompt 含分析字段、追问指令、正文', () => {
  const p = buildProbePrompt('你在哪长大的？', '我在东北的一个小城长大。', [], []);
  assert.match(p, /tags/);
  assert.match(p, /isEvasion/);
  assert.match(p, /followup/);
  assert.match(p, /细节/);
  assert.match(p, /回避/);
  assert.match(p, /我在东北的一个小城长大。/);
  assert.match(p, /你在哪长大的？/);
});

test('buildProbePrompt 有历史时注入、无历史时不注入', () => {
  const withHist = buildProbePrompt('q', 'a', [{ question: '前一题', answer: '前一答' }], []);
  assert.match(withHist, /前一答/);
  const noHist = buildProbePrompt('q', 'a', [], []);
  assert.doesNotMatch(noHist, /最近的对话/);
});

test('buildProbePrompt 注入 knownTags', () => {
  assert.match(buildProbePrompt('q', 'a', [], ['startup', 'family']), /startup/);
});

test('parseProbeJson 正常扁平 JSON → {analysis, followup}', () => {
  const r = parseProbeJson(
    '{"tags":["startup"],"year":1990,"location":"东北","isEvasion":false,"evasionType":null,"softLanding":null,"followup":{"ask":true,"question":"那家店后来怎样了？"}}',
  );
  assert.deepEqual(r.analysis.tags, ['startup']);
  assert.equal(r.analysis.year, 1990);
  assert.equal(r.analysis.isEvasion, false);
  assert.equal(r.followup.ask, true);
  assert.equal(r.followup.question, '那家店后来怎样了？');
});

test('parseProbeJson 容忍 ```json 代码块', () => {
  const r = parseProbeJson('```json\n{"tags":[],"followup":{"ask":false,"question":""}}\n```');
  assert.equal(r.followup.ask, false);
});

test('parseProbeJson 坏 JSON → 安全默认（ask:false）', () => {
  const r = parseProbeJson('抱歉我无法完成');
  assert.deepEqual(r.analysis.tags, []);
  assert.equal(r.analysis.isEvasion, false);
  assert.equal(r.followup.ask, false);
  assert.equal(r.followup.question, '');
});

test('parseProbeJson 缺 followup 字段 → ask:false', () => {
  const r = parseProbeJson('{"tags":["x"],"isEvasion":true}');
  assert.equal(r.analysis.isEvasion, true);
  assert.equal(r.followup.ask, false);
});
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`，报找不到模块。

- [ ] **Step 3: 写实现** — 创建 `functions/api/_lib/lifestory-probe.js`：

```js
// 服务端纯逻辑：拼「分析+追问」提示词、解析 LLM 输出成 {analysis, followup}。
// 零依赖，可 node --test。

const TAG_VOCAB =
  'entrepreneur startup quit_job career_change fired achievement parent_conflict family_pressure ' +
  'expectation sibling marriage divorce partner loneliness isolation friendship betrayal migration ' +
  'moved abroad cultural_shock belonging death loss grief illness health art music writing creative ' +
  'design performance study university teacher finance debt wealthy poor investment faith religion ' +
  'belief spiritual identity culture heritage fairness justice courage sacrifice risk';

export function buildProbePrompt(question, answer, recentHistory = [], knownTags = []) {
  const hist = (Array.isArray(recentHistory) ? recentHistory : [])
    .slice(-4)
    .map((a) => `问：${a.question}\n答：${a.answer}`)
    .join('\n\n');
  const known = Array.isArray(knownTags) && knownTags.length ? `\n已知标签：${knownTags.join('、')}` : '';
  return `你是访谈分析与追问系统。先分析受访者对当前问题的回答，再决定是否顺着回答追问一句。

【追问原则 — 像一个克制、专业的访谈者】
- 逼细节：顺着受访者刚说的具体的人/事/词，追问一个具体的东西——某一件事、某个场景、当时什么样、后来怎样、那一刻的感受。一次只问一个。
- 顺带澄清：回答含糊、跳跃、前后不清时，改问温和的澄清（时间先后、指代对象、关系），而不是深挖。
- 尊重回避：若受访者在回避（isEvasion=true），不要追问、不要在伤口上追，followup.ask 设为 false。
- 老人友好：追问要短、具体、口语，避免抽象宏大的提问。
- 克制：不奉承、不煽情，不说"你真勇敢/谢谢分享"，平实白描。
- 若回答已足够具体、或再问也问不出更多，followup.ask 设为 false。

严格输出以下 JSON（不要代码块，不要多余文字）：
{
  "tags": [],
  "year": null,
  "location": null,
  "isEvasion": false,
  "evasionType": null,
  "softLanding": null,
  "followup": { "ask": false, "question": "" }
}
tags 从以下词汇中选择：${TAG_VOCAB}

${hist ? `最近的对话：\n${hist}\n\n` : ''}当前问答：\n问：${question}\n答：${answer}${known}\n\n请分析并输出 JSON：`;
}

export function parseProbeJson(raw) {
  const safe = {
    analysis: {
      tags: [],
      year: null,
      location: null,
      isEvasion: false,
      evasionType: null,
      softLanding: null,
    },
    followup: { ask: false, question: '' },
  };
  try {
    const obj = JSON.parse(
      String(raw)
        .replace(/```(?:json)?\n?/g, '')
        .replace(/```/g, '')
        .trim(),
    );
    const fu = obj.followup && typeof obj.followup === 'object' ? obj.followup : {};
    return {
      analysis: {
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        year: obj.year ?? null,
        location: obj.location ?? null,
        isEvasion: obj.isEvasion === true,
        evasionType: obj.evasionType ?? null,
        softLanding: obj.softLanding ?? null,
      },
      followup: {
        ask: fu.ask === true,
        question: typeof fu.question === 'string' ? fu.question : '',
      },
    };
  } catch {
    return { analysis: { ...safe.analysis }, followup: { ...safe.followup } };
  }
}
```

- [ ] **Step 4: 跑测试确认通过** — `npm test`，新增 7 条全 PASS。

- [ ] **Step 5: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write functions/api/_lib/lifestory-probe.js tests/lifestory-probe.test.mjs` 后再跑。

- [ ] **Step 6: 提交**
```bash
git add functions/api/_lib/lifestory-probe.js tests/lifestory-probe.test.mjs
git commit -m "feat(lifestory): probe 提示词与解析纯函数 + 单测"
```

---

## Task 2: 客户端纯函数 decideProbe（TDD）

**Files:**
- Create: `js/shared/lifestory-flow.js`
- Test: `tests/lifestory-flow.test.mjs`

- [ ] **Step 1: 写失败测试** — 创建 `tests/lifestory-flow.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideProbe } from '../js/shared/lifestory-flow.js';

const ask = (q = '再说说？') => ({ followup: { ask: true, question: q } });

test('ask=true 且未达上限 → ask', () => {
  assert.equal(decideProbe(ask(), 0, 2), 'ask');
  assert.equal(decideProbe(ask(), 1, 2), 'ask');
});

test('ask=true 但已达上限 → advance', () => {
  assert.equal(decideProbe(ask(), 2, 2), 'advance');
  assert.equal(decideProbe(ask(), 3, 2), 'advance');
});

test('ask=false → advance', () => {
  assert.equal(decideProbe({ followup: { ask: false, question: '' } }, 0, 2), 'advance');
});

test('followup.question 为空 → advance（即使 ask 为真）', () => {
  assert.equal(decideProbe({ followup: { ask: true, question: '  ' } }, 0, 2), 'advance');
});

test('缺 followup / 非对象 → advance（容错）', () => {
  assert.equal(decideProbe({}, 0, 2), 'advance');
  assert.equal(decideProbe(null, 0, 2), 'advance');
});
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`，报找不到模块。

- [ ] **Step 3: 写实现** — 创建 `js/shared/lifestory-flow.js`：

```js
// 客户端纯逻辑：根据 probe 结果 + 本锚点已追问次数 + 上限，决定追问还是换题。
// 零依赖，可 node --test。DOM/流程胶水留在页面。
export function decideProbe(probeResult, followupCount, cap = 2) {
  const fu = probeResult && probeResult.followup;
  const ask =
    !!fu && fu.ask === true && typeof fu.question === 'string' && fu.question.trim().length > 0;
  return ask && followupCount < cap ? 'ask' : 'advance';
}
```

- [ ] **Step 4: 跑测试确认通过** — `npm test`，新增 5 条全 PASS。

- [ ] **Step 5: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write js/shared/lifestory-flow.js tests/lifestory-flow.test.mjs` 后再跑。

- [ ] **Step 6: 提交**
```bash
git add js/shared/lifestory-flow.js tests/lifestory-flow.test.mjs
git commit -m "feat(lifestory): 追问深度决策纯函数 decideProbe + 单测"
```

---

## Task 3: lifestory.js 加 probe action

**Files:**
- Modify: `functions/api/lifestory.js`

先 Read 现文件：顶部 `qwen(apiKey, system, user, maxTokens, temp)` 辅助函数、`SYS_ANALYZE`/`SYS_BRIDGE`/`SYS_STORY` 常量、`onRequest` 里 `if (action === 'analyze')` / `'bridge'` / `'story'` 分支。

- [ ] **Step 1: import 纯函数**

顶部（`const QWEN_URL = ...` 之后）加：
```js
import { buildProbePrompt, parseProbeJson } from './_lib/lifestory-probe.js';
```

- [ ] **Step 2: 加 probe 分支**

在 `if (action === 'analyze') { ... }` 分支**之后**、`'bridge'` 分支之前，加：
```js
    if (action === 'probe') {
      const { question, answer, recentHistory = [], knownTags = [] } = body;
      if (!question || !answer) {
        return new Response(JSON.stringify({ error: '缺少 question/answer' }), {
          status: 400,
          headers: h,
        });
      }
      const raw = await qwen(
        apiKey,
        '你是访谈分析与追问系统，严格按用户消息的要求只输出 JSON。',
        buildProbePrompt(question, answer, recentHistory, knownTags),
        500,
        0.5,
      );
      const result = parseProbeJson(raw);
      return new Response(JSON.stringify(result), { headers: h });
    }
```
（`h` 是文件里已有的 `{ 'Content-Type': 'application/json' }`。`analyze` 分支保持不动。）

- [ ] **Step 3: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write functions/api/lifestory.js` 后再跑。

- [ ] **Step 4: 提交**
```bash
git add functions/api/lifestory.js
git commit -m "feat(lifestory): 端点加 probe action（分析+追问合一，返回 analysis+followup）"
```

---

## Task 4: lifestory.html 集成（退役 BRANCHES + 深挖循环）

**Files:**
- Modify: `solutions/demo/lifestory.html`

先 Read 该文件：普通 `<script>`（约 270 起）里的 `BRANCHES` 数组（约 295 起）、`pickNext`（约 423）里"优先级 2：衍生追问"分支（约 450-458）、`callAnalyze`（约 483）、`submitAnswer`（约 630）、`nextTurn`（约 570）、`showQ`（约 605）、`defState`（存 state 默认值）；底部 `<script type="module">`（约 1029）。

- [ ] **Step 1: 底部 module 脚本——桥接 decideProbe 到 window**

在底部 `<script type="module">` 的 import 区加：
```js
import { decideProbe } from '/js/shared/lifestory-flow.js';
```
在 import 之后加：
```js
window.sdfDecideProbe = decideProbe;
```

- [ ] **Step 2: 删 BRANCHES + 标签选题分支**

删除普通脚本里整个 `const BRANCHES = [ ... ];` 数组定义。
删除 `pickNext` 里"优先级 2：衍生追问（标签匹配…）"整段（从注释 `// 优先级 2` 到该 `if (best) return {...}` 结束的那几行，即基于 `BRANCHES.filter(...).map(...score...)` 的块）。
删除 `pickNext` 里"优先级 4：剩余衍生题"整段（`const anyBranch = BRANCHES.find(...)` 那两行），并把该函数结尾改为在锚点用尽后返回 `null`：把
```js
  // 优先级 4：剩余衍生题（锚点全部答完后）
  const anyBranch = BRANCHES.find(q => !usedIds.includes(q.id) && matchesTheme(q));
  return anyBranch ? { ...anyBranch, type: 'branch' } : null;
```
改为
```js
  return null;
```
（历史题优先级 1、锚点优先级 3 保留不动。）

- [ ] **Step 3: defState 加 followupCount**

在 `defState()` 返回的 state 默认对象里加一个字段 `followupCount: 0`（与 `answers`/`tags`/`usedIds` 等并列）。

- [ ] **Step 4: callAnalyze 旁边加 callProbe**

在 `callAnalyze` 函数之后加：
```js
async function callProbe(question, answer) {
  const res = await apiFetch('/api/lifestory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'probe',
      question, answer,
      recentHistory: state.answers.slice(-4),
      knownTags: state.tags,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data; // { analysis, followup }
}
```

- [ ] **Step 5: submitAnswer 改用 probe + 加深挖循环**

在 `submitAnswer` 里，把隐私/正常两分支的分析获取改为 probe：把
```js
    if (privacy) {
      analysis = { tags:[], year:null, location:null, isEvasion:false, softLanding:null };
    } else {
      analysis = await callAnalyze(currentQ.text, answer);
    }
```
改为
```js
    if (privacy) {
      probeResult = { analysis: { tags:[], year:null, location:null, isEvasion:false, evasionType:null, softLanding:null }, followup: { ask:false, question:'' } };
    } else {
      probeResult = await callProbe(currentQ.text, answer);
    }
    analysis = probeResult.analysis;
```
并在函数开头声明 `probeResult` 的地方与 `analysis` 一起：把 `let analysis;` 改为 `let analysis, probeResult;`。

然后把函数结尾的 `await nextTurn(analysis, answer);`（约 700 行，在"每答完 8 题"提示 return 之后）替换为深挖决策：
```js
  const step = window.sdfDecideProbe(probeResult, state.followupCount || 0, 2);
  if (step === 'ask') {
    state.followupCount = (state.followupCount || 0) + 1;
    const fq = { id: 'fu-' + Date.now(), type: 'followup', cat: currentQ.cat, text: probeResult.followup.question };
    saveState();
    let bridge = '';
    try { bridge = await callBridge(answer, fq.text); } catch { bridge = ''; }
    currentQ = fq;
    showQ(fq, bridge);
  } else {
    state.followupCount = 0;
    saveState();
    await nextTurn(analysis, answer);
  }
```
（回避分支 `if (analysis.isEvasion) { ... return; }` 在此之前已提前 return，追问逻辑只对非回避回答生效，符合设计。）

- [ ] **Step 6: 跑闸门** — `npm run check` 全绿（lifestory 非 Tailwind 页，qa:css 不受影响、无需 build:css）。eslint 若报 `BRANCHES` 未定义/未用，说明删除有残留，回去清干净。prettier 报格式则 `npx prettier --write solutions/demo/lifestory.html` 后再跑。

- [ ] **Step 7: 提交**
```bash
git add solutions/demo/lifestory.html
git commit -m "feat(lifestory): 退役 BRANCHES、改调 probe、加 AI 自适应追问深挖循环（每锚点≤2句）"
```

---

## Task 5: 文档

**Files:**
- Modify: `docs/TOOLS.md`

- [ ] **Step 1: 记录到 TOOLS.md**（找 lifestory 那节的「修改记录」，按现有条目风格插入）：

```markdown
  - 2026-07-29：AI 自适应追问——退役预写的 BRANCHES（标签→预写追问表），改由端点 `probe` action（`functions/api/_lib/lifestory-probe.js` 的 `buildProbePrompt`/`parseProbeJson`，有单测）一次调用完成"分析+生成追问或换题"，返回 `{analysis, followup}`。追问顺着受访者刚说的具体内容逼细节/顺带澄清/尊重回避/老人友好/克制taste。每锚点最多 2 句追问（`js/shared/lifestory-flow.js` 的 `decideProbe` + 前端 `followupCount`，有单测），AI 判够了/回避就换题；追问失败或坏 JSON 优雅回落下一锚点。15 锚点、历史题、bridge、story 不变，保留 qwen-plus。
```

- [ ] **Step 2: 跑闸门** — `npm run check` 全绿。

- [ ] **Step 3: 提交**
```bash
git add docs/TOOLS.md
git commit -m "docs(lifestory): 记录 AI 自适应追问机制"
```

---

## 收尾（人工，挂账镜像恢复）

镜像恢复上线后走一遍真实访谈：① 追问是否顺着具体内容、逼出细节 ② 回避时不硬追 ③ 每锚点追问不超过 2 句 ④ 含糊回答能被澄清 ⑤ 老人视角问题够短够具体 ⑥ probe 失败时访谈不中断。

---

## Self-Review

**1. Spec 覆盖**
- 退役 BRANCHES（spec §3.1）→ Task 4 Step2 ✅
- 合并 probe 调用（§3.2）→ Task 1（prompt/parse）+ Task 3（action）+ Task 4 Step4（callProbe）✅
- 深挖循环 + CAP=2（§3.3）→ Task 2（decideProbe）+ Task 4 Step3/5（followupCount + 循环）✅
- probe 提示词要点（§4）→ Task 1 Step3 buildProbePrompt 内容（逼细节/澄清/回避/老人/克制）✅
- 可测纯逻辑（§5）→ Task 1（buildProbePrompt/parseProbeJson）+ Task 2（decideProbe）✅（parseProbeJson 归到服务端 _lib，与 buildProbePrompt 同处，比 spec 原定的 js/shared 更合理——解析发生在服务端；decideProbe 客户端）
- 容错（§9）→ parseProbeJson 坏 JSON 默认 + decideProbe 容错 + Task 4 callBridge try/catch + CAP ✅

**2. 无占位符**：新模块/测试/端点均含完整代码。Task 4 因大文件，删改以"现有代码→改为"精确锚点给出，标注"以 Read 到的实际为准"。

**3. 命名一致性**：`buildProbePrompt`/`parseProbeJson`/`decideProbe`、返回结构 `{analysis:{tags,year,location,isEvasion,evasionType,softLanding}, followup:{ask,question}}`、`callProbe`、`state.followupCount`、`window.sdfDecideProbe`、CAP=2 全计划一致。
