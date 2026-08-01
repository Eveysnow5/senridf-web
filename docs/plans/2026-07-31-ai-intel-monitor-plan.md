# 日本 AI 情报监控 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 照招标爬虫同构，建一个周更的「日本 AI 情报监控」流水线：抓 RSS/官方列表页 → Qwen 判定三主题（陪伴/硬件/政策）+ 中文摘要 → 入 Firestore `ai_intel`，失败/过滤落旁路 `ai_intel_rejected`，每周归纳一份防编造简报 `ai_intel_digest`，后台展示。

**Architecture:** 纯逻辑（周次/解析/判定解析/简报校验）拆成 4 个可 `node --test` 的 CommonJS 模块；信源配置集中在 `sources.js`；`index.js` 编排 IO（抓取/Firestore/Qwen），照 `scripts/bid-scraper/index.js` 的写法。GitHub Actions 周更 cron + 仓库护栏。admin 后台加卡片展示。

**Tech Stack:** Node 20 (CommonJS)、axios、cheerio（RSS/HTML 解析）、firebase-admin（Firestore 写入）、Qwen qwen-plus（判定/摘要/简报）。测试用 `node:test` + `node:assert` + `tests/fixtures/`。质量闸门 `npm run check`（eslint + prettier + node --test + qa + qa:css）。

**部署上下文：** 纯静态零构建，Windows 开发机。部署走 push→自动镜像→Cloudflare，**镜像当前坏着**（MIRROR_PAT 失效），push 仅进源仓库备份、不会上线；线上验证挂账。**push 需先总结并征得用户确认**——本计划所有 commit 都是本地提交，不含 push。

**设计依据：** `docs/specs/2026-07-31-ai-intel-monitor-design.md`

**同构参照（实现前先 Read）：** `scripts/bid-scraper/index.js`（编排/initFirebase/urlHash/Qwen 调用/去重/运行报告）、`scripts/bid-scraper/parse.js`（纯解析结构）、`tests/bid-scraper.parse.test.js`（测试+fixture 写法）、`scripts/bid-scraper/package.json`、`.github/workflows/scrape-bids.yml`。

**关键约定（避免踩坑）：**
- 运行报告写 **`meta/ai_intel_status`**（独立文档），**不要**写 `meta/scrape_status`（那是招标爬虫的，会被覆盖）。
- `solutions/demo/admin.html` 是 **Tailwind 页**：改完若新增了当前没用过的 class，必须跑 `npm run build:css` 重新生成 `css/tailwind.min.css` 并提交，否则 `npm run qa:css` 会失败。
- 子代理跑命令用 `git -C "路径"` / `npm --prefix "路径"`，避免 `cd` 复合命令触发权限弹窗。

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `scripts/ai-intel-scraper/week.js` | 纯逻辑：Date → ISO 周次 `'YYYY-Www'` |
| `scripts/ai-intel-scraper/parse.js` | 纯解析：RSS/Atom feed + 官方列表页 → `{title,url,published_at}[]` |
| `scripts/ai-intel-scraper/relevance.js` | 纯逻辑：判定提示词构造 + Qwen JSON 解析 + 坏 JSON 兜底 + theme 白名单 |
| `scripts/ai-intel-scraper/digest.js` | 纯逻辑：简报提示词构造 + "只引已入库条目" 校验 |
| `scripts/ai-intel-scraper/sources.js` | 信源配置（数组，可增删） |
| `scripts/ai-intel-scraper/index.js` | 编排 IO：抓取→去重→判定/摘要→入库→旁路→简报→运行报告 |
| `scripts/ai-intel-scraper/package.json` | 依赖清单（axios/cheerio/firebase-admin），供 workflow `npm install` |
| `.github/workflows/scrape-ai-intel.yml` | 周更 cron + 仓库护栏 |
| `tests/ai-intel.week.test.js` | week.js 单测 |
| `tests/ai-intel.parse.test.js` | parse.js 单测（+ `tests/fixtures/ai-intel-*`） |
| `tests/ai-intel.relevance.test.js` | relevance.js 单测 |
| `tests/ai-intel.digest.test.js` | digest.js 单测 |
| `solutions/demo/admin.html` | 加「AI 情报」卡片（条目流 + 主题/周筛选 + 简报 + 待核实子区） |
| `docs/TOOLS.md` | 新增一节：AI 情报监控 |

---

## Task 1: week.js — ISO 周次（纯逻辑，TDD）

**Files:**
- Create: `scripts/ai-intel-scraper/week.js`
- Test: `tests/ai-intel.week.test.js`

- [ ] **Step 1: 写失败测试**

`tests/ai-intel.week.test.js`：
```js
const { test } = require('node:test');
const assert = require('node:assert');
const { isoWeek } = require('../scripts/ai-intel-scraper/week');

test('isoWeek：2026-01-01（周四）属于 2026-W01', () => {
  assert.equal(isoWeek(new Date(2026, 0, 1)), '2026-W01');
});

test('isoWeek：跨年周归属正确——2025-12-29（周一）属于 2026-W01', () => {
  assert.equal(isoWeek(new Date(2025, 11, 29)), '2026-W01');
});

test('isoWeek：2026-07-31（周五）属于 2026-W31', () => {
  assert.equal(isoWeek(new Date(2026, 6, 31)), '2026-W31');
});

test('isoWeek：周数补零到两位', () => {
  assert.match(isoWeek(new Date(2026, 0, 5)), /^2026-W\d{2}$/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: FAIL —— `Cannot find module '../scripts/ai-intel-scraper/week'`

- [ ] **Step 3: 实现 week.js**

```js
// ISO 8601 周次标签 'YYYY-Www'。纯函数，无依赖。
// 用"最近的周四"确定 ISO 周年（跨年边界周归属由周四决定）。
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 周一=0 … 周日=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // 移到本周周四
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4)); // 1月4日必在第1周
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

module.exports = { isoWeek };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: PASS（4 个 week 测试全绿）

- [ ] **Step 5: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add scripts/ai-intel-scraper/week.js tests/ai-intel.week.test.js
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): ISO 周次纯函数 week.js"
```

---

## Task 2: parse.js — RSS/Atom/列表页解析（纯解析，TDD）

**Files:**
- Create: `scripts/ai-intel-scraper/parse.js`
- Create: `tests/fixtures/ai-intel-rss.xml`, `tests/fixtures/ai-intel-atom.xml`, `tests/fixtures/ai-intel-list.html`
- Test: `tests/ai-intel.parse.test.js`

- [ ] **Step 1: 建测试 fixtures**

`tests/fixtures/ai-intel-rss.xml`：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Sample Feed</title>
  <item>
    <title>介護ロボット新製品を発表</title>
    <link>https://example.com/news/1</link>
    <pubDate>Mon, 27 Jul 2026 09:00:00 +0900</pubDate>
  </item>
  <item>
    <title>AIチップの量産開始</title>
    <link>https://example.com/news/2</link>
    <pubDate>Tue, 28 Jul 2026 10:00:00 +0900</pubDate>
  </item>
</channel></rss>
```

`tests/fixtures/ai-intel-atom.xml`：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sample Atom</title>
  <entry>
    <title>AI規制ガイドライン改訂</title>
    <link rel="alternate" href="https://example.org/a/10"/>
    <updated>2026-07-29T08:00:00Z</updated>
  </entry>
</feed>
```

`tests/fixtures/ai-intel-list.html`：
```html
<!doctype html><html><body>
  <nav><a href="/">ホーム</a></nav>
  <div id="main">
    <ul>
      <li><a href="/press/2026/07/20260728.html">半導体戦略に関する報道発表</a></li>
      <li><a href="https://www.meti.go.jp/press/abs.html">AI事業者ガイドラインについて</a></li>
      <li><a href="#top">ページ上部へ</a></li>
    </ul>
  </div>
</body></html>
```

- [ ] **Step 2: 写失败测试**

`tests/ai-intel.parse.test.js`：
```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFeed, parseListLinks, toIso } = require('../scripts/ai-intel-scraper/parse');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('parseFeed：解析 RSS 2.0 的 item（标题/链接/日期）', () => {
  const items = parseFeed(fixture('ai-intel-rss.xml'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '介護ロボット新製品を発表');
  assert.equal(items[0].url, 'https://example.com/news/1');
  assert.match(items[0].published_at, /^2026-07-27T/);
});

test('parseFeed：解析 Atom 的 entry（link href / updated）', () => {
  const items = parseFeed(fixture('ai-intel-atom.xml'));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'AI規制ガイドライン改訂');
  assert.equal(items[0].url, 'https://example.org/a/10');
  assert.equal(items[0].published_at, '2026-07-29T08:00:00.000Z');
});

test('toIso：坏日期返回 null', () => {
  assert.equal(toIso('不是日期'), null);
  assert.equal(toIso(''), null);
});

test('parseListLinks：容器内取链接、解析相对路径、跳过锚点/导航', () => {
  const items = parseListLinks(fixture('ai-intel-list.html'), {
    linkSelector: '#main a',
    base: 'https://www.meti.go.jp/press/',
  });
  // 只取 #main 内的两条真链接；#top 锚点被跳过；nav 不在 #main 内
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://www.meti.go.jp/press/2026/07/20260728.html');
  assert.equal(items[1].url, 'https://www.meti.go.jp/press/abs.html');
  assert.equal(items[0].published_at, null);
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: FAIL —— `Cannot find module '../scripts/ai-intel-scraper/parse'`

- [ ] **Step 4: 实现 parse.js**

```js
// 纯解析：RSS/Atom feed 与官方列表页 → 条目。只依赖 cheerio，可离线单测。
const cheerio = require('cheerio');

// 日期字符串 → ISO 字符串，解析失败返回 null。
function toIso(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// 解析 RSS 2.0 或 Atom feed → [{ title, url, published_at }]。
function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  // RSS 2.0: <item><title/><link/><pubDate/>
  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const url = $(el).find('link').first().text().trim();
    const pub = $(el).find('pubDate').first().text().trim();
    if (title && url) items.push({ title, url, published_at: toIso(pub) });
  });

  // Atom: <entry><title/><link href=.../><updated|published/>
  $('entry').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const href =
      $(el).find('link[rel="alternate"]').attr('href') ||
      $(el).find('link').first().attr('href') ||
      '';
    const pub =
      $(el).find('updated').first().text().trim() ||
      $(el).find('published').first().text().trim();
    if (title && href) items.push({ title, url: href.trim(), published_at: toIso(pub) });
  });

  return items;
}

// 官方列表页：在 linkSelector 范围内取 <a>，相对路径按 base 解析。
// → [{ title, url, published_at: null }]。列表页一般拿不到发布日期，留 null。
function parseListLinks(html, { linkSelector, base }) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  $(linkSelector).each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!title || title.length < 5) return;
    if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('javascript'))
      return;
    const url = href.startsWith('http') ? href : new URL(href, base).toString();
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ title, url, published_at: null });
  });
  return out;
}

module.exports = { parseFeed, parseListLinks, toIso };
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: PASS（parse 4 个测试 + Task1 的 week 测试全绿）

- [ ] **Step 6: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add scripts/ai-intel-scraper/parse.js tests/ai-intel.parse.test.js tests/fixtures/ai-intel-rss.xml tests/fixtures/ai-intel-atom.xml tests/fixtures/ai-intel-list.html
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): RSS/Atom/列表页纯解析 parse.js"
```

---

## Task 3: relevance.js — 判定提示词 + JSON 解析兜底（纯逻辑，TDD）

**Files:**
- Create: `scripts/ai-intel-scraper/relevance.js`
- Test: `tests/ai-intel.relevance.test.js`

**接口契约（后续 Task 6 依赖，务必一致）：**
- `THEMES` = `['companion', 'hardware', 'policy']`
- `buildJudgmentPrompt(item)` → string，`item = { title, url, raw? }`
- `parseJudgment(raw)` → `{ keep, theme, summary_zh, key_facts, reason }`
  - 成功：`{ keep:true, theme, summary_zh, key_facts:[], reason:'' }`
  - 模型判否：`{ keep:false, theme:null, summary_zh:'', key_facts:[], reason:'filtered_out' }`
  - 解析失败/字段缺失/theme 非法：`reason:'bad_json'`

- [ ] **Step 1: 写失败测试**

`tests/ai-intel.relevance.test.js`：
```js
const { test } = require('node:test');
const assert = require('node:assert');
const { THEMES, buildJudgmentPrompt, parseJudgment } = require('../scripts/ai-intel-scraper/relevance');

test('THEMES 是三主题白名单', () => {
  assert.deepEqual(THEMES, ['companion', 'hardware', 'policy']);
});

test('buildJudgmentPrompt：含标题、三主题定义、JSON 输出指令', () => {
  const p = buildJudgmentPrompt({ title: '介護ロボット発表', url: 'https://x/1' });
  assert.match(p, /介護ロボット発表/);
  assert.match(p, /companion/);
  assert.match(p, /hardware/);
  assert.match(p, /policy/);
  assert.match(p, /JSON/);
});

test('parseJudgment：正常 keep=true 解析出 theme/summary', () => {
  const r = parseJudgment('{"keep":true,"theme":"companion","summary_zh":"某公司发布陪伴机器人。"}');
  assert.equal(r.keep, true);
  assert.equal(r.theme, 'companion');
  assert.equal(r.summary_zh, '某公司发布陪伴机器人。');
  assert.deepEqual(r.key_facts, []);
});

test('parseJudgment：带 ```json 代码块也能解析', () => {
  const r = parseJudgment('```json\n{"keep":true,"theme":"hardware","summary_zh":"AI 芯片量产。"}\n```');
  assert.equal(r.keep, true);
  assert.equal(r.theme, 'hardware');
});

test('parseJudgment：keep=false → reason filtered_out', () => {
  const r = parseJudgment('{"keep":false,"reason":"不属于三主题"}');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'filtered_out');
});

test('parseJudgment：坏 JSON → reason bad_json、keep=false', () => {
  const r = parseJudgment('这不是 JSON');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'bad_json');
});

test('parseJudgment：theme 不在白名单 → bad_json', () => {
  const r = parseJudgment('{"keep":true,"theme":"education","summary_zh":"x"}');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'bad_json');
});

test('parseJudgment：keep=true 但 summary 空 → bad_json', () => {
  const r = parseJudgment('{"keep":true,"theme":"policy","summary_zh":"   "}');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'bad_json');
});

test('parseJudgment：key_facts 只保留字符串项', () => {
  const r = parseJudgment('{"keep":true,"theme":"policy","summary_zh":"x","key_facts":["a",1,null,"b"]}');
  assert.deepEqual(r.key_facts, ['a', 'b']);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: FAIL —— `Cannot find module '../scripts/ai-intel-scraper/relevance'`

- [ ] **Step 3: 实现 relevance.js**

```js
// 纯逻辑：判定提示词构造 + Qwen 判定 JSON 解析兜底 + theme 白名单。无网络、无 Firebase。
const THEMES = ['companion', 'hardware', 'policy'];

// 构造单条候选的判定提示词。
function buildJudgmentPrompt(item) {
  return `你是日本 AI 市场情报分析助手。判断下面这条日本资讯是否属于以下三个主题之一，并做中文摘要。

主题定义：
- companion：介护/陪伴机器人、家用陪伴 AI、老龄照护相关机器人产品或研究。
- hardware：AI 芯片、半导体、边缘 AI、AI 计算硬件、机器人硬件。
- policy：日本政府对 AI 的支持政策/补助/战略，以及 AI 监管/规制/指针。

标题：${item.title}
链接：${item.url}
${item.raw ? `内容片段：${item.raw}` : ''}

规则：
- 若不属于以上任一主题，或是纯招聘/广告软文/无实质内容，返回 keep=false。
- 若属于，返回 keep=true，并给出 theme（只能是 companion/hardware/policy 之一）、summary_zh（1～3 句简体中文摘要，禁止日语假名）、可选 key_facts（关键数字/事实数组，每条注明来源标题）。
- 严格输出 JSON，不要代码块，不要多余文字。示例：
{"keep":true,"theme":"companion","summary_zh":"…","key_facts":["…（来源:标题）"]}
或
{"keep":false,"reason":"不属于三主题"}`;
}

// 解析模型返回的判定 JSON，坏数据一律安全兜底。
function parseJudgment(raw) {
  const fail = (reason) => ({ keep: false, theme: null, summary_zh: '', key_facts: [], reason });
  if (!raw || typeof raw !== 'string') return fail('bad_json');

  const text = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return fail('bad_json');
  }
  if (!obj || typeof obj !== 'object') return fail('bad_json');
  if (obj.keep !== true) return fail('filtered_out');
  if (!THEMES.includes(obj.theme)) return fail('bad_json');

  const summary = typeof obj.summary_zh === 'string' ? obj.summary_zh.trim() : '';
  if (!summary) return fail('bad_json');

  const key_facts = Array.isArray(obj.key_facts)
    ? obj.key_facts.filter((x) => typeof x === 'string')
    : [];

  return { keep: true, theme: obj.theme, summary_zh: summary, key_facts, reason: '' };
}

module.exports = { THEMES, buildJudgmentPrompt, parseJudgment };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: PASS（relevance 9 个测试 + 前两任务全绿）

- [ ] **Step 5: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add scripts/ai-intel-scraper/relevance.js tests/ai-intel.relevance.test.js
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): 判定提示词+JSON解析兜底 relevance.js"
```

---

## Task 4: digest.js — 简报提示词 + 防编造校验（纯逻辑，TDD）

**Files:**
- Create: `scripts/ai-intel-scraper/digest.js`
- Test: `tests/ai-intel.digest.test.js`

**接口契约：**
- `buildDigestPrompt(items, week)` → string，`items = [{ title, summary_zh, theme, url }]`
- `validateDigestCitations(bodyMd, items)` → `{ ok, unknownUrls }`（简报正文里出现的 URL 若不在 items 集合内即为编造）

- [ ] **Step 1: 写失败测试**

`tests/ai-intel.digest.test.js`：
```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildDigestPrompt, validateDigestCitations } = require('../scripts/ai-intel-scraper/digest');

const items = [
  { title: '介護ロボA', summary_zh: '发布陪伴机器人 A。', theme: 'companion', url: 'https://x/1' },
  { title: 'AIチップB', summary_zh: '量产 AI 芯片 B。', theme: 'hardware', url: 'https://x/2' },
];

test('buildDigestPrompt：含周次、条目摘要与链接、防编造指令', () => {
  const p = buildDigestPrompt(items, '2026-W31');
  assert.match(p, /2026-W31/);
  assert.match(p, /发布陪伴机器人 A。/);
  assert.match(p, /https:\/\/x\/1/);
  assert.match(p, /只准归纳/); // 防编造纪律出现在提示词里
});

test('validateDigestCitations：只引已入库链接 → ok', () => {
  const body = '## 陪伴\n- 机器人 A 发布（https://x/1）\n## 硬件\n- 芯片 B（https://x/2）';
  const r = validateDigestCitations(body, items);
  assert.equal(r.ok, true);
  assert.deepEqual(r.unknownUrls, []);
});

test('validateDigestCitations：出现库外链接 → 不 ok 并列出', () => {
  const body = '- 编造条目（https://evil/9）\n- 真条目（https://x/1）';
  const r = validateDigestCitations(body, items);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unknownUrls, ['https://evil/9']);
});

test('validateDigestCitations：无链接正文 → ok（没有编造 URL）', () => {
  const r = validateDigestCitations('本周无值得注意的动态。', items);
  assert.equal(r.ok, true);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: FAIL —— `Cannot find module '../scripts/ai-intel-scraper/digest'`

- [ ] **Step 3: 实现 digest.js**

```js
// 纯逻辑：每周简报提示词构造 + "只引已入库条目" 防编造校验。无网络、无 Firebase。

// 构造简报提示词：把本周入库条目全量喂进去，硬性约束只准归纳、不准编造。
function buildDigestPrompt(items, week) {
  const lines = items
    .map(
      (it, i) =>
        `${i + 1}. [${it.theme}] ${it.title}\n   摘要：${it.summary_zh}\n   链接：${it.url}`,
    )
    .join('\n');

  return `你在为「日本 AI 情报监控」生成第 ${week} 周简报。下面是本周已入库的全部情报条目：

${lines}

要求：
- 只准归纳上面列出的条目，严禁引入列表中没有的数字、事实或条目。
- 严禁夸大或拔高；拿不准就照条目原意写。
- 按三个主题分组（陪伴/介护机器人、AI 硬件/半导体、政策与监管），每组挑出值得注意的要点，每条要点后用括号附上对应条目的链接。
- 用简体中文、Markdown 格式。若某主题本周无条目，写「本周无」。`;
}

// 校验简报正文里出现的 URL 是否都来自已入库条目。→ { ok, unknownUrls }。
function validateDigestCitations(bodyMd, items) {
  const allowed = new Set(items.map((it) => it.url));
  const urls = bodyMd.match(/https?:\/\/[^\s)）\]]+/g) || [];
  const unknownUrls = [...new Set(urls)].filter((u) => !allowed.has(u));
  return { ok: unknownUrls.length === 0, unknownUrls };
}

module.exports = { buildDigestPrompt, validateDigestCitations };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" test`
Expected: PASS（digest 4 个测试 + 前三任务全绿）

- [ ] **Step 5: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add scripts/ai-intel-scraper/digest.js tests/ai-intel.digest.test.js
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): 简报提示词+防编造校验 digest.js"
```

---

## Task 5: sources.js + package.json — 信源配置与依赖

**Files:**
- Create: `scripts/ai-intel-scraper/sources.js`
- Create: `scripts/ai-intel-scraper/package.json`

> 说明：`sources.js` 是**数据配置**，不写单测。其中的 URL 是初版尽力值，**部分 feed 可能 404 或结构不同**——实施时逐条 `curl` 冒烟验证（见 Step 3），跑不通的源注释掉并记在 TOOLS.md，不硬凑。这不阻塞后续任务：Task 6 编排逻辑对空源/坏源已有容错。

- [ ] **Step 1: 建 sources.js**

```js
// 日本 AI 情报信源配置。增删源改这里即可。
// type: 'rss'（feed）| 'list'（官方 HTML 列表页，需 linkSelector + base）。
// theme_hint 仅供人阅读参考；实际主题由 Qwen 判定决定，不受此值约束。
module.exports = [
  // ── 陪伴 / 介护机器人 ──
  { name: 'ロボスタ', type: 'rss', url: 'https://robotstart.info/feed', theme_hint: 'companion' },
  { name: 'PR TIMES', type: 'rss', url: 'https://prtimes.jp/index.rdf', theme_hint: 'companion' },

  // ── AI 硬件 / 半导体 ──
  { name: 'ITmedia AI+', type: 'rss', url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml', theme_hint: 'hardware' },
  { name: 'Preferred Networks', type: 'rss', url: 'https://www.preferred.jp/ja/news/feed/', theme_hint: 'hardware' },

  // ── 政策 / 监管 ──（官方列表页，逐条冒烟验证 selector）
  {
    name: '経産省ニュースリリース',
    type: 'list',
    url: 'https://www.meti.go.jp/press/index.html',
    linkSelector: '#maincontents a, #main a, .press a',
    base: 'https://www.meti.go.jp/press/',
    theme_hint: 'policy',
  },
];
```

- [ ] **Step 2: 建 package.json（照 bid-scraper）**

```json
{
  "name": "ai-intel-scraper",
  "version": "1.0.0",
  "description": "Weekly scraper for Japan AI market intelligence (companion / hardware / policy)",
  "main": "index.js",
  "dependencies": {
    "axios": "^1.7.0",
    "cheerio": "^1.0.0",
    "firebase-admin": "^12.0.0"
  }
}
```

- [ ] **Step 3: 冒烟验证各源可达（人工，不阻塞）**

逐条快速验证 feed 是否返回可解析内容（示例，逐个源替换 URL）：
```bash
curl -sL --max-time 20 "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml" | head -c 500
```
Expected: 看到 `<rss` / `<feed` / `<item` 等结构。跑不通的源在 `sources.js` 里用 `//` 注释掉，并在 Task 9 的 TOOLS.md 里记一句"某源待替换"。**政策列表页的 `linkSelector` 需实际抓一次页面确认命中招标列表容器**（`curl -sL URL | grep -o 'id="[^"]*"' | sort -u` 看有哪些容器 id），命不中就调选择器。

- [ ] **Step 4: 跑 check 确认无 lint/format 问题**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run lint && npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run format:check`
Expected: PASS（如 format 报格式，先跑 `npm run format` 再提交）

- [ ] **Step 5: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add scripts/ai-intel-scraper/sources.js scripts/ai-intel-scraper/package.json
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): 信源配置 sources.js + 依赖清单"
```

---

## Task 6: index.js — 编排（IO，人工验证）

**Files:**
- Create: `scripts/ai-intel-scraper/index.js`

> 说明：这是 IO 编排层（网络/Firestore/Qwen），照 `scripts/bid-scraper/index.js` 同构，**不写单测**，留人工验证（Step 3）。所有纯逻辑已在 Task 1–4 测过。

- [ ] **Step 1: 实现 index.js**

```js
const axios = require('axios');
const { createHash } = require('crypto');
const admin = require('firebase-admin');
const SOURCES = require('./sources');
const { parseFeed, parseListLinks } = require('./parse');
const { isoWeek } = require('./week');
const { buildJudgmentPrompt, parseJudgment } = require('./relevance');
const { buildDigestPrompt, validateDigestCitations } = require('./digest');

function initFirebase() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

function urlHash(url) {
  return createHash('md5').update(url).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sixMonthsFromNow() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d;
}

async function fetchSource(src) {
  const res = await axios.get(src.url, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AiIntelScraper/1.0)' },
  });
  return res.data;
}

async function qwen(prompt, maxTokens, timeout) {
  const res = await axios.post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    { model: 'qwen-plus', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens },
    {
      headers: {
        Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout,
    },
  );
  return res.data.choices?.[0]?.message?.content?.trim() || '';
}

async function writeRunReport(db, report) {
  try {
    await db
      .collection('meta')
      .doc('ai_intel_status')
      .set({ ...report, finished_at: admin.firestore.FieldValue.serverTimestamp() });
    console.log('Run report written to meta/ai_intel_status');
  } catch (e) {
    console.error('Failed to write run report:', e.message);
  }
}

async function main() {
  const startedAt = Date.now();
  const db = initFirebase();
  const col = db.collection('ai_intel');
  const rejectedCol = db.collection('ai_intel_rejected');
  const week = isoWeek(new Date());

  const totals = {
    found: 0,
    inserted: 0,
    skipped_dup: 0,
    filtered_out: 0,
    llm_error: 0,
    failed_fetch: 0,
  };
  const sources = [];
  const weekItems = []; // 本次成功入库的条目，供简报归纳

  try {
    for (const src of SOURCES) {
      const stat = { name: src.name, found: 0, inserted: 0, error: '' };
      console.log(`\n[${src.name}] ${src.url}`);

      let raw;
      try {
        raw = await fetchSource(src);
      } catch (err) {
        console.error(`  Fetch failed: ${err.message}`);
        stat.error = `抓取失败: ${err.message}`;
        totals.failed_fetch++;
        sources.push(stat);
        continue;
      }

      let items = [];
      try {
        items =
          src.type === 'rss'
            ? parseFeed(raw)
            : parseListLinks(raw, { linkSelector: src.linkSelector, base: src.base });
      } catch (err) {
        console.error(`  Parse failed: ${err.message}`);
        stat.error = `解析失败: ${err.message}`;
        totals.failed_fetch++;
        sources.push(stat);
        continue;
      }
      stat.found = items.length;
      totals.found += items.length;

      for (const item of items) {
        const hash = urlHash(item.url);

        // 去重：主库或旁路已有则跳过（避免失败项每周重复判定）
        const dupMain = await col.where('url_hash', '==', hash).limit(1).get();
        if (!dupMain.empty) {
          totals.skipped_dup++;
          continue;
        }
        const dupRej = await rejectedCol.where('url_hash', '==', hash).limit(1).get();
        if (!dupRej.empty) {
          totals.skipped_dup++;
          continue;
        }

        // Qwen 判定 + 摘要
        let verdict;
        try {
          const rawJudgment = await qwen(buildJudgmentPrompt(item), 500, 30000);
          verdict = parseJudgment(rawJudgment);
        } catch (err) {
          console.error(`  Judge failed for "${item.title}": ${err.message}`);
          verdict = { keep: false, reason: 'llm_error' };
        }

        if (!verdict.keep) {
          const reason = verdict.reason || 'filtered_out';
          if (reason === 'llm_error') totals.llm_error++;
          else totals.filtered_out++;
          await rejectedCol.add({
            url_hash: hash,
            title: item.title || '',
            url: item.url,
            source: src.name,
            reason,
            raw_snippet: (item.raw || item.title || '').slice(0, 500),
            fetched_at: admin.firestore.FieldValue.serverTimestamp(),
            week,
            expireAt: sixMonthsFromNow(),
          });
          console.log(`  - reject (${reason}): ${item.title}`);
          await sleep(400);
          continue;
        }

        await col.add({
          url_hash: hash,
          title: item.title,
          summary_zh: verdict.summary_zh,
          theme: verdict.theme,
          source: src.name,
          url: item.url,
          published_at: item.published_at || null,
          fetched_at: admin.firestore.FieldValue.serverTimestamp(),
          week,
          key_facts: verdict.key_facts,
        });
        weekItems.push({
          title: item.title,
          summary_zh: verdict.summary_zh,
          theme: verdict.theme,
          url: item.url,
        });
        console.log(`  + [${verdict.theme}] ${item.title}`);
        stat.inserted++;
        totals.inserted++;
        await sleep(600);
      }

      sources.push(stat);
    }

    // 本周简报：只归纳本次入库条目
    let digestOk = false;
    if (weekItems.length > 0) {
      try {
        const body = await qwen(buildDigestPrompt(weekItems, week), 2000, 60000);
        const { ok, unknownUrls } = validateDigestCitations(body, weekItems);
        await db
          .collection('ai_intel_digest')
          .doc(week)
          .set({
            week,
            generated_at: admin.firestore.FieldValue.serverTimestamp(),
            body_md: body,
            item_count: weekItems.length,
            source_urls: weekItems.map((i) => i.url),
            citation_ok: ok,
            unknown_urls: unknownUrls,
          });
        digestOk = ok;
        console.log(`Digest written for ${week} (citation_ok=${ok})`);
      } catch (err) {
        console.error(`Digest failed: ${err.message}`);
      }
    }

    console.log(
      `\nDone. +${totals.inserted} ingested, ${totals.filtered_out} filtered, ${totals.llm_error} llm-errors.`,
    );
    await writeRunReport(db, {
      ok: true,
      week,
      digest_ok: digestOk,
      duration_ms: Date.now() - startedAt,
      totals,
      sources,
    });
  } catch (err) {
    await writeRunReport(db, {
      ok: false,
      error: err.message,
      week,
      duration_ms: Date.now() - startedAt,
      totals,
      sources,
    });
    throw err;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: 跑 check（lint/format 覆盖 index.js）**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run lint && npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run format:check`
Expected: PASS（如 format 报错先 `npm run format`）

- [ ] **Step 3: 人工验证（本地实跑一次，需真凭证）**

在有 `FIREBASE_SERVICE_ACCOUNT` + `QWEN_API_KEY` 环境变量的机器上：
```bash
npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web/scripts/ai-intel-scraper" install
node "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web/scripts/ai-intel-scraper/index.js"
```
Expected: 控制台逐源打印 found/入库/reject；Firestore 出现 `ai_intel`、可能有 `ai_intel_rejected`、`ai_intel_digest/{周}`、`meta/ai_intel_status`。检查 ① 三主题条目抓得对不对 ② 中文摘要忠不忠实 ③ 简报 `citation_ok` 是否 true。**若无凭证，此步挂账到镜像恢复/上线阶段人工做，不阻塞提交。**

- [ ] **Step 4: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add scripts/ai-intel-scraper/index.js
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): 编排 index.js（抓取→判定→入库→旁路→简报→运行报告）"
```

---

## Task 7: workflow — 周更 cron + 仓库护栏

**Files:**
- Create: `.github/workflows/scrape-ai-intel.yml`

- [ ] **Step 1: 建 workflow（照 scrape-bids.yml，改为周更）**

```yaml
name: Scrape Japan AI Intel

on:
  schedule:
    - cron: '0 20 * * 0'   # 每周一 05:00 JST（周日 20:00 UTC）
  workflow_dispatch:         # 允许 GitHub UI 手动触发

jobs:
  scrape:
    # 只在源仓库跑（有 secrets）。同步副本 Eveysnow5/senridf-web 里跳过、不失败、不发邮件。
    if: github.repository == 'sherlockafa007/senridoufuu-web'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: scripts/ai-intel-scraper
        run: npm install

      - name: Run scraper
        working-directory: scripts/ai-intel-scraper
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          QWEN_API_KEY: ${{ secrets.QWEN_API_KEY }}
        run: node index.js
```

- [ ] **Step 2: 校验 YAML 无语法错误**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('c:/Users/sherl/Desktop/Claude Code/senridoufuu-web/.github/workflows/scrape-ai-intel.yml','utf8');if(!/cron: '0 20 \* \* 0'/.test(s))throw new Error('cron missing');console.log('yaml ok')"`
Expected: 打印 `yaml ok`

- [ ] **Step 3: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add .github/workflows/scrape-ai-intel.yml
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "ci(ai-intel): 周更 cron workflow + 仓库护栏"
```

---

## Task 8: admin.html — 「AI 情报」卡片（DOM/Firebase 胶水，人工验证）

**Files:**
- Modify: `solutions/demo/admin.html`
- Modify: `css/tailwind.min.css`（若新增 Tailwind class，需 `build:css` 重新生成）

> 说明：这是 DOM/Firebase 展示胶水，**不写单测**，人工验证。**实现前先 Read `solutions/demo/admin.html`**，找到现有「招标抓取监控」卡片（读 `meta/scrape_status` 那段），照它同构：复用相同的卡片壳/样式类/Firestore 读取写法，只换集合与字段。这样能最大化复用已验证的 Tailwind class，减少 `build:css` 触发。

- [ ] **Step 1: Read admin.html，定位现有招标监控卡片**

Run: 用 Grep 找锚点
`grep -n "scrape_status\|招标抓取监控\|meta" "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web/solutions/demo/admin.html"`
读取该卡片的 HTML 结构 + 其数据加载 JS（Firestore 读取 + 渲染），作为同构模板。

- [ ] **Step 2: 加「AI 情报」卡片 HTML**

在招标监控卡片之后插入一个同结构卡片（class 尽量复用现有卡片的），含三块：
1. 最新一周简报（读 `ai_intel_digest`，按 week 倒序取 1 条，渲染 `body_md`——若页面已有 marked，用它渲染；否则 `white-space:pre-wrap` 纯文本展示）。
2. 条目流（读 `ai_intel`，按 `fetched_at` 倒序，限 200 条；顶部三个主题筛选按钮 companion/hardware/policy + 「全部」，每条显示 `title` / `summary_zh` / `source` / 链接 / `theme` 标签 / `week`）。
3. 待核实子区（读 `ai_intel_rejected`，倒序限 100 条，显示计数 + 可折叠展开：`title` / `source` / `reason` / 链接）。

> 具体 class 照现有卡片复用；主题筛选用现有页面已有的按钮/标签样式，避免引入新 Tailwind class。

- [ ] **Step 3: 加数据加载 JS**

在页面现有脚本区（与招标监控加载逻辑同处），加载函数照此形状（用页面已有的 Firestore `db` 实例与既有写法）：
```js
// 读最新一周简报
async function loadAiIntelDigest() {
  const snap = await db.collection('ai_intel_digest').orderBy('week', 'desc').limit(1).get();
  const el = document.getElementById('aiIntelDigest');
  if (snap.empty) { el.textContent = '本周暂无简报'; return; }
  const d = snap.docs[0].data();
  el.textContent = `【${d.week}】\n` + (d.body_md || '');
  // 若 d.citation_ok === false，附一行提示「简报含未匹配链接，请人工核对」
}

// 读条目流（可按主题过滤）
async function loadAiIntelItems(theme) {
  let q = db.collection('ai_intel').orderBy('fetched_at', 'desc').limit(200);
  if (theme && theme !== 'all') q = db.collection('ai_intel').where('theme', '==', theme).orderBy('fetched_at', 'desc').limit(200);
  const snap = await q.get();
  const list = document.getElementById('aiIntelList');
  list.innerHTML = '';
  snap.forEach((doc) => {
    const it = doc.data();
    const row = document.createElement('div');
    row.textContent = `[${it.theme}] ${it.title} — ${it.summary_zh}（${it.source}）`;
    // 加原文链接 <a href=it.url target=_blank rel=noopener>原文</a>、week 标签
    list.appendChild(row);
  });
}

// 读待核实
async function loadAiIntelRejected() {
  const snap = await db.collection('ai_intel_rejected').orderBy('fetched_at', 'desc').limit(100).get();
  document.getElementById('aiIntelRejectedCount').textContent = snap.size;
  const list = document.getElementById('aiIntelRejectedList');
  list.innerHTML = '';
  snap.forEach((doc) => {
    const r = doc.data();
    const row = document.createElement('div');
    row.textContent = `(${r.reason}) ${r.title} — ${r.source}`;
    list.appendChild(row);
  });
}
```
在页面初始化（管理员登录确认后，与招标监控同一处）调用这三个 loader；三个主题筛选按钮各绑定 `loadAiIntelItems('companion'|'hardware'|'policy'|'all')`。

> **注意（踩坑）：** 若卡片是动态插入的元素，不要挂只在页面加载时扫描一次的滚动动画标记（`data-animate` 之类），会永久 `opacity:0` 不可见（TOOLS.md 记录过 blog 卡片这个坑）。

- [ ] **Step 4: 若新增了 Tailwind class，重新生成 CSS**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run build:css`
然后 `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run qa:css`
Expected: `qa:css` PASS（逐字节一致）。若之前没跑 build:css 而 qa:css 报错，说明确实引入了新 class，跑 build:css 后再验。

- [ ] **Step 5: 跑完整 check**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run check`
Expected: PASS（lint + format + test + qa + qa:css 全绿）

- [ ] **Step 6: 人工验证（挂账到上线阶段）**

镜像恢复/本地起页面后，管理员登录看卡片：三主题筛选能切、简报能显示、待核实计数与展开正常。无凭证/无数据时应显示"暂无"而非报错。

- [ ] **Step 7: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add solutions/demo/admin.html css/tailwind.min.css
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "feat(ai-intel): admin 后台 AI 情报卡片（条目流+简报+待核实）"
```

---

## Task 9: TOOLS.md — 新增工具档案节

**Files:**
- Modify: `docs/TOOLS.md`

- [ ] **Step 1: 在招标爬虫节（§6 bids）之后新增一节**

内容要点（照现有节体例：用途/架构/用谁的 API/所需设置/维护注意/修改记录）：
```markdown
## 6.5 ai-intel-scraper/ — 日本 AI 情报监控（内部工具）

- **用途**：每周自动抓日本 AI 相关一手信源（陪伴/介护机器人、AI 硬件/半导体、政府政策与监管），Qwen 判定三主题 + 中文摘要入库，生成每周简报，后台展示。主用途：给半年度日本 AI 市场调研报告攒研究素材（见 project_japan_ai_report）；辅：Blog 选题。
- **架构**：
  - 爬虫：`scripts/ai-intel-scraper/`（index.js 编排；纯逻辑 week.js/parse.js/relevance.js/digest.js 有 node --test；sources.js 信源配置）
  - 调度：GitHub Actions `.github/workflows/scrape-ai-intel.yml`，cron `0 20 * * 0`（周一 05:00 JST），仓库护栏只在源仓库跑
  - 存储：Firestore `ai_intel`（主库，url_hash 去重、只增不删）/ `ai_intel_rejected`（失败/过滤旁路，6 个月 TTL）/ `ai_intel_digest/{周}`（每周简报）；运行报告 `meta/ai_intel_status`（独立于招标的 scrape_status）
  - 前端：`solutions/demo/admin.html`「AI 情报」卡片（条目流 + 主题/周筛选 + 简报 + 待核实子区）
- **用谁的 API**：通义千问 Qwen（qwen-plus，判定/摘要/简报）。数据源：ロボスタ/PR TIMES/ITmedia AI+/Preferred Networks/経産省 等（RSS 优先 + 官方列表页，见 sources.js）。
- **所需设置**：复用 GitHub Secrets `QWEN_API_KEY` + `FIREBASE_SERVICE_ACCOUNT`（与招标爬虫同）。Firebase 规则需允许管理员读 `ai_intel`/`ai_intel_digest`/`ai_intel_rejected`；`ai_intel_rejected` 配 expireAt TTL（同 errors/visits，受 GCP 权限限制可暂缓）。
- **防编造纪律**：简报只准归纳已入库条目，`validateDigestCitations` 校验正文 URL 是否都在库内，`citation_ok=false` 时后台提示人工核对（对齐半年报"榜单数字多被编造"教训）。
- **维护注意**：sources.js 里的 feed URL 可能失效/改版——某源连续 `failed` 或 `found:0` 时 curl 复核、必要时替换；政策列表页 linkSelector 站点改版可能失配。
- **修改记录**：
  - 2026-07-31：上线（爬虫 + 周更 workflow + admin 卡片）。spec 见 docs/specs/2026-07-31-ai-intel-monitor-design.md，plan 见 docs/plans/2026-07-31-ai-intel-monitor-plan.md。
```
> 同时检查 TOOLS.md 是否有"后端 Functions 一览"外的**全局工具清单/概览**需要同步（本工具是 scripts 爬虫、非 functions 端点，通常不进后端 Functions 表；但若文件顶部有工具总目录，补一行）。

- [ ] **Step 2: 跑 check（qa 扫描死链/markdown）**

Run: `npm --prefix "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" run check`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" add docs/TOOLS.md
git -C "c:/Users/sherl/Desktop/Claude Code/senridoufuu-web" commit -m "docs(ai-intel): TOOLS.md 新增 AI 情报监控工具档案"
```

---

## 收尾（全部任务后）

- [ ] 跑一次完整 `npm run check` 确认全绿。
- [ ] 分派最终整体审查子代理（superpowers:requesting-code-review），重点核：① 纯逻辑测试覆盖是否真跑到新模块 ② index.js 与 relevance/digest 的接口字段名是否一致（theme/summary_zh/url/reason）③ 运行报告写的是 `meta/ai_intel_status` 不是 `scrape_status` ④ admin 卡片有没有引入未 build 的 Tailwind class（qa:css）⑤ 防编造校验是否接线到位。
- [ ] **上线前人工挂账清单**（镜像恢复后）：Firebase 加 `ai_intel`/`ai_intel_digest`/`ai_intel_rejected` 读规则；本地实跑 index.js 一次看三主题抓取质量与简报 citation_ok；sources.js 各源冒烟通过。
- [ ] **push 需先向用户总结改动并征得确认**（镜像坏着，push 仅备份不上线）。
```
