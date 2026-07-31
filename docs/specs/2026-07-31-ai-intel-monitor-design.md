# 日本 AI 情报监控 · 设计

日期：2026-07-31
状态：已与用户确认方向，待写实施计划

## 1. 背景与目标

给自动化能力补一个「A 类流水线」自动 agent（区别于 agentic 循环）：定时爬日本 AI 相关一手信源 → Qwen 过滤业务相关 → 中文摘要入库 → 后台展示 + 每周简报。架构照现有招标爬虫（`scripts/bid-scraper` + GitHub Actions cron + Firestore + admin 卡片）克隆，维护心智几乎零增量。

**主用途 A（主）**：给半年度《日本生成式人工智能市场调研报告》攒研究素材（见 `project_japan_ai_report`）。低频、重深度与**可追溯**、别漏别编。
**辅用途 C（辅）**：Blog / 对外内容的选题素材源。
**不做 B**：不做"实时情报台"（无需高频日更）。

**频率**：**每周一次**（周更足矣）。

**产出优先级**：**积累的数据库（`ai_intel` 集合）是根本**；每周简报 / 可视化目录是锦上添花那层。

**三条主题线**（收窄聚焦，对上半年报最硬的三块）：
1. **陪伴** —— 介护 / 陪伴机器人。
2. **硬件** —— AI 芯片 / 半导体 / 边缘 AI。
3. **政策监管** —— 日本政府 AI 支持政策 + 监管策略。

## 2. 范围

**做**：
- `scripts/ai-intel-scraper/`：周更爬虫（RSS 优先 + 官方列表页），逐源抓取、去重、Qwen 相关性判定 + 中文摘要 + 主题标签，入 Firestore `ai_intel`。
- 每周简报：全部入库后跑一次 LLM 归纳，写 `ai_intel_digest/{week}`。
- GitHub Actions cron（周更）+ 仓库护栏；运行报告写 `meta/scrape_status`（复用现有监控）。
- admin 后台「AI 情报」卡片：数据库条目流（按主题/周筛选）+ 最新一周简报。
- 纯逻辑拆 `node --test` 模块。

**明确不做（YAGNI）**：
- 不做实时/日更（B）。
- 不硬爬结构不稳的新闻站（版权 + 反爬 + 版式脆）——只取 RSS 与结构稳定的官方列表页。
- 不整段转载原文（只存标题 + 自产中文摘要 + 链接）。
- 不做复杂可视化图表（先条目流 + 简报文本；图表以后再说）。
- 不换模型体系（用 qwen-plus，与全站一致）。

## 3. 架构与数据流

```
GitHub Actions cron（每周一次，JST 周一早）
  → scripts/ai-intel-scraper/index.js
     ├ 抓取：RSS 优先 + 少量官方列表页（Cheerio 仅用于结构稳定的官方页）
     ├ 去重：url_hash（照 bids，只新增不删）
     ├ 逐条过滤+摘要：Qwen 判「是否属于三主题且值得留」→ 否则丢弃（照 NOT_A_BID 兜底）；
     │              是则日→中摘要 + 打 theme 标签（+ 可选 key_facts）
     └ 入库 Firestore `ai_intel`
  → 全部入库后，跑一次「本周简报」LLM 归纳 → 写 `ai_intel_digest/{week}`
  → 运行报告写 meta/scrape_status
后台：admin 加「AI 情报」卡片 —— 条目流（按主题/周筛选）+ 最新一周简报
```

与招标爬虫同构，唯一新增步骤是"每周简报归纳"。CI 护栏照 bids 加 `if: github.repository == 'sherlockafa007/senridoufuu-web'`，只在源仓库跑。

## 4. 信源清单（初版，配置化可增删）

只存**标题 + 自产中文摘要 + 原文链接**，不整段转载。约 8–12 源起步，集中配置在一处（照 bids）。

**陪伴 / 介护机器人**
- GROOVE X（LOVOT）、Sony aibo、Yukai Engineering、Preferred Networks（Kachaka）—— 公司新闻/PR 页
- ロボスタ robotstart.jp —— RSS，机器人/陪伴专门，信噪比高
- PR TIMES 机器人/AI 分类 —— 厂商产品 PR 聚合，分类 feed

**AI 硬件 / 半导体 / 边缘 AI**
- 経産省(METI) 新闻稿列表 —— 半导体战略、Rapidus、介护机器人导入补助
- Preferred Networks（MN-Core）、Sakana AI —— 公司新闻
- ITmedia AI+ —— RSS，覆盖硬件动态

**政策监管**
- 経産省(METI)、総務省、内閣府 / デジタル庁 AI 战略 —— 官方新闻/政策列表页
- IPA / AI事業者ガイドライン、個人情報保護委員会 —— 监管侧

**兜底扩面**
- Google News 日本，关键词查询（介護ロボット / AIチップ / エッジAI / コンパニオンロボット / AI規制 / AI戦略 等）

> 说明：政策线全是政府官网列表页，结构稳、无版权顾虑，最好爬。实施时逐源确认是否有 RSS；无 RSS 且结构不稳的源降级为 Google News 关键词覆盖，不硬爬。

## 5. 数据结构

**Firestore `ai_intel` 集合**（每条 = 一条情报）：
```
{
  url_hash,        // 去重键（照 bids）
  title,           // 原文标题（保留日文原题）
  summary_zh,      // 自产中文摘要（1–3 句）
  theme,           // 'companion' | 'hardware' | 'policy'
  source,          // 源名（GROOVE X / METI / ロボスタ…）
  url,             // 原文链接（可追溯，半年报引用用）
  published_at,    // 原文日期（拿得到就存，否则 null）
  fetched_at,      // 抓取时间
  week,            // 归属周（如 '2026-W31'）
  key_facts        // 可选：抽到的关键数字/事实数组，每条带 "(来源:标题)"
}
```

**Firestore `ai_intel_digest/{week}`**（每周一份简报）：
```
{
  week,            // '2026-W31'
  generated_at,
  body_md,         // 简报正文（Markdown，按三主题分组）
  item_count,      // 本周入库条目数
  source_urls      // 简报引用到的原始条目 url 列表（可追溯校验）
}
```

**Firestore `ai_intel_rejected` 集合**（旁路"待核实"记录，不进主库）：
```
{
  url_hash,        // 去重键（同一条失败项不重复堆积）
  title,           // 原文标题（拿得到就存）
  url,             // 原文链接
  source,          // 源名
  reason,          // 'llm_error' | 'bad_json' | 'filtered_out' | 'fetch_partial'
  raw_snippet,     // 判定时喂给 Qwen 的原始片段（截断），供人工核实"为什么判失败"
  fetched_at,
  week,
  expireAt         // 写入时间 + 6 个月（配合 Firestore TTL 自动清理，同 errors/visits）
}
```

**运行报告** 写入 `meta/scrape_status`（复用现有结构 + 现有 admin 监控卡片）：完成时间 + 各源 found/inserted/skipped/failed。

## 6. 相关性判定与简报归纳

### 6.1 相关性判定（防噪音）
Qwen 对每条判 `{ keep: bool, theme, reason }`：
- `keep:true` → 生成 `summary_zh` + `theme`（+ 可选 `key_facts`），入主库 `ai_intel`。
- 不属于三主题、或纯软文/招聘/无实质内容 → `keep:false`，**不进主库**，但写一条到旁路 `ai_intel_rejected`（`reason:'filtered_out'`）。
- **判定/解析失败**（Qwen 出错 / 坏 JSON / 抓取残缺）→ **不进主库**，写旁路 `ai_intel_rejected`（`reason:'llm_error'|'bad_json'|'fetch_partial'`）。

**取舍**：主库 `ai_intel` 宁缺毋滥（漏一条可容忍，混入垃圾污染研究素材不可容忍）；但失败/过滤掉的条目**不静默消失**，落旁路留记录 —— 便于用户日后人工核实，也帮诊断"为什么判失败/为什么被滤掉"（调信源、调提示词的依据）。旁路记录带 6 个月 TTL，自动清理不堆积。

### 6.2 每周简报（最要盯"防编造"，对齐核实教训）
半年报核实教训：行业榜单数字多被编造，交付前必须回一手源。简报这步最易复现该风险，硬性纪律：
- 简报**只准归纳 `ai_intel` 里已入库的条目**，每个论断必须能指回具体条目的 `url`。
- 提示词硬约束：**不得引入库里没有的数字/事实、不得拔高**。
- 结构：按三主题（陪伴 / 硬件 / 政策）分组 + "本周值得注意的 N 条" + 每条挂出处链接。
- 简报是**可追溯的二次归纳**，不是新信息源——半年报最终引用仍回到原始条目的一手链接。
- `source_urls` 记录简报引用到的条目链接，供事后校验"简报没有凭空捏造条目"。

## 7. 组件 / 文件

| 文件 | 动作 | 职责 |
|---|---|---|
| `scripts/ai-intel-scraper/sources.js` | 新建 | 信源配置（源名 / URL / 类型 rss\|html / theme 提示） |
| `scripts/ai-intel-scraper/parse.js` | 新建 | 纯解析：RSS/官方列表页 → 条目 `{title,url,published_at}`（有 `node --test`） |
| `scripts/ai-intel-scraper/relevance.js` | 新建 | 纯逻辑：Qwen 判定 JSON 解析 + 坏 JSON 兜底 + theme 白名单校验（有 `node --test`） |
| `scripts/ai-intel-scraper/week.js` | 新建 | 纯逻辑：日期 → ISO 周次 `'YYYY-Www'`（有 `node --test`） |
| `scripts/ai-intel-scraper/digest.js` | 新建 | 纯逻辑：简报提示词构造 + "只引已入库条目" 校验函数（有 `node --test`） |
| `scripts/ai-intel-scraper/index.js` | 新建 | 编排：抓取→去重→Qwen 判定/摘要→入库→简报→运行报告（IO，`main()` 仅直接运行时执行） |
| `tests/ai-intel-scraper.*.test.js` | 新建 | 上述纯逻辑单测 |
| `.github/workflows/scrape-ai-intel.yml` | 新建 | 周更 cron + 仓库护栏 |
| `solutions/demo/admin.html` | 改 | 加「AI 情报」卡片（条目流 + 主题/周筛选 + 最新简报；含「待核实」子区显示 `ai_intel_rejected` 计数 + 可展开列表） |
| `docs/TOOLS.md` | 改 | 新增一节：AI 情报监控（信源 / 架构 / 所需设置 / 修改记录） |

## 8. 成本

周频。每周约 N 条 × 1 次判定/摘要调用 + 1 次简报归纳。用 **qwen-plus**（判定/摘要够用），量小、一周一次，成本可忽略。复用现有 `QWEN_API_KEY`（GitHub Secrets，与招标爬虫同）。

## 9. 测试

- **纯逻辑（node --test）**：`parse`（RSS/列表页解析结构正确）、`relevance`（Qwen JSON 正常/坏 JSON 兜底/theme 白名单）、`week`（周次计算边界）、`digest`（"只引已入库条目"校验、简报无凭空条目）、url_hash 去重。
- **不单测**：抓取 IO / Firestore 写入 / LLM 质量 —— 留人工验证。
- **人工验证**：跑一遍看 ① 三主题条目是否抓准、垃圾是否滤掉 ② 中文摘要是否忠实 ③ 简报是否只归纳已入库条目、有无编造/拔高。
- **CI 护栏**：`if: github.repository == 'sherlockafa007/senridoufuu-web'`，只在源仓库跑（照 bids）。

## 10. 错误处理

- 单源抓取失败不影响其他源（逐源 try/catch，失败计入运行报告 `failed`）。
- LLM 判定/解析失败或被过滤的条目**不进主库**，改写旁路 `ai_intel_rejected` 留记录（见 §6.1），供人工核实与诊断。
- 简报生成失败不影响已入库条目（简报是独立后置步骤，失败仅记录，下周重来）。
- Firestore 写入沿用 Admin SDK（与 bids 同凭证 `FIREBASE_SERVICE_ACCOUNT`）。

## 11. 所需设置（人工，上线前）

- GitHub Secrets：复用 `QWEN_API_KEY` + `FIREBASE_SERVICE_ACCOUNT`（与招标爬虫同，源仓库已有）。
- **Firebase 控制台加规则**：`ai_intel` / `ai_intel_digest` / `ai_intel_rejected` 读需允许管理员读（admin 卡片展示）；写由 Admin SDK（绕过规则）。参照 bids 的 `meta` 读规则。
- **Firestore TTL 策略**：`ai_intel_rejected` 集合按 `expireAt` 字段配 TTL（同 errors/visits，受 GCP 权限限制时可暂缓，不影响功能）。
- 镜像链恢复后才会上线到 senridf.com（当前 MIRROR_PAT 失效，push 仅进源仓库备份）。
