# 校对工具语义深化 设计（qwen-max + 参考资料对照 + 原文高亮）

日期：2026-07-28
状态：已与用户确认方向，待写实施计划

## 1. 背景

`solutions/demo/proofreader.html` 是中文新闻稿校对工具（qwen-plus 单次整篇 ≤2万字，查六类：错别字/重复残句/编辑残留/前后逻辑冲突/标题一致/中文排版；结果是分类问题卡片，支持粘贴/上传 docx，历史 localStorage）。

用户明确：**要的是语义检查，不是格式**。机械排版规则（中英文空格、全/半角标点等）不是需求。真正想抓的三个语义维度：**事实与逻辑一致、表述清晰、论证完整**。而且事实核查的正确形态不是"regex 搜事实"，而是**把稿件对照原始参考资料（访谈记录文字版）做语义比对**——这契合团队"访谈→成稿"的工作流。

## 2. 范围

**做**：
- A. 语义深化：换 qwen-max + 重写提示词，深化三个语义维度，砍掉排版，保留有用的轻量类。
- B. 参考资料对照：加可选的参考资料上传，作为 reference 送模型，核查稿件是否忠实于来源。
- C. 原文内联高亮（简化版）：把问题片段在原文里高亮，**不做**卡片↔高亮联动。

**明确不做（YAGNI）**：
- 中文排版规范/机械格式 linter（用户不要）。
- 一键应用/导出订正稿（故意让用户手动改以示重视）。
- 卡片与高亮的双向点击定位（简化）。
- regex 式事实搜索/外部知识库核查。
- 术语表复用（不在本期）。

## 3. A. 语义深化

### 3.1 检查项重构

| 类别 | 处理 | 说明 |
|---|---|---|
| 错别字 | 保留 | 形近/音近错字、标点误入词内 |
| 重复或未完成句子 | 保留 | 重复表达、截断句、语义未完 |
| 编辑指令/插入残留 | 保留 | "(此处插入…)"、发布前须清理的编辑备注 |
| **事实与逻辑一致** | **深化** | 前后矛盾、数字/时间/事实对不上、与常识不符、无依据的断言；**若提供参考资料，核查是否忠实于来源**（见 §4） |
| **表述清晰** | **新增** | 歧义、含糊、指代不明、别扭/冗余——**只报真正影响理解的**，不逐句挑刺 |
| **论证完整** | **新增** | 关键信息缺失、论点无支撑、逻辑跳跃、结论站不住 |
| 标题与正文一致性 | 保留 | 标题是否准确反映正文 |
| ~~中文排版规范~~ | **删除** | 用户不要的格式项 |

### 3.2 提示词设计要点

- 每个语义维度引导模型**讲清"为什么是问题"并给具体建议**，而非表面匹配。
- **阈值/精度**：明确要求"只报真正要紧的问题"。语义类（尤其表述清晰、论证完整）最易噪音爆炸，提示词必须压阈值，否则报告不可用。
- **输出格式保持不变**：`## 分类标题` + 逐条 `- **原文**：\`片段\`` / `**问题**：…` / `**建议**：…`；某类无问题写 `> 未发现问题`。这样页面既有的 `parseSections`/`parseErrorItems`/`renderErrorItem` 管线不用改，只需更新 `CATS` 分类清单。

### 3.3 模型

- `qwen-plus` → **`qwen-max`**（推理最强，语义/论证类需要）。`max_tokens` 保持 6000。
- 成本：qwen-max 每次调用比 qwen-plus 贵数倍；校对低频、可接受。质量不满意可一行改回。

## 4. B. 参考资料对照

- proofreader.html 加**第二个上传入口**「参考资料（访谈记录等，可选）」，复用现有 docx/txt 文字提取（mammoth）。
- 提取文字作为 `reference` 字段随请求 body 送给 `/api/proofread`。**上限 20000 字**（与正文同口径），超出截断并在结果区提示"参考资料过长已截断"。
- 提示词：**当 reference 非空时**，在"事实与逻辑一致"类下增加核查——稿件是否忠实于参考资料（与来源矛盾、无依据添加、断章取义）；reference 为空时该指令不出现。
- 该逻辑落在纯函数 `buildProofreadPrompt(text, reference)`：reference 为空/缺省 → 生成的提示词与"无参考资料"版本一致（不改变原行为）。

## 5. C. 原文内联高亮（简化版）

- 校对结果区**上方**加只读「原文（已标注）」面板。
- 把所有问题的「原文」片段（来自 LLM 报告解析出的 `original`）用 `indexOf` 在原文里定位，`<mark class="pf-hl">` 高亮；**找不到的跳过**（片段照常在卡片里显示）。
- **无卡片↔高亮双向联动**（本期简化）。
- 纯逻辑抽出可测：
  - `locateSnippet(text, snippet)` → 首次出现的 `{index, length}` 或 `null`。
  - `mergeSpans(spans)` → 按 index 排序、合并/去除重叠。
  - `buildAnnotatedSegments(text, spans)` → `[{text, highlighted:boolean}]` 段序列（纯，供页面拼 HTML）。
- DOM 组装（把 segments 转成 `<mark>`/文本、转义）留在页面。
- 说明：语义类问题（论证/逻辑）的「原文」常是长片段或被模型转述，`indexOf` 可能定位失败——这是预期的优雅降级，卡片仍完整展示。

## 6. 数据流

```
用户粘贴/上传正文（+可选上传参考资料）
  → 点「校对」
  → 客户端 POST /api/proofread { text, reference }
  → proofread.js: buildProofreadPrompt(text, reference) → qwen-max
  → 返回 Markdown 报告
  → 页面 parseSections（按新 CATS）→ 卡片
  → 同时用各卡片 original 片段构建「原文（已标注）」高亮面板
```

## 7. 组件/文件

| 文件 | 动作 | 职责 |
|---|---|---|
| `functions/api/_lib/buildProofreadPrompt.js` | 新建 | 纯函数：text + 可选 reference → 完整提示词。可测。 |
| `tests/build-proofread-prompt.test.mjs` | 新建 | 上面的单测。 |
| `js/shared/proofread-highlight.js` | 新建 | 纯逻辑：`locateSnippet`/`mergeSpans`/`buildAnnotatedSegments`。 |
| `tests/proofread-highlight.test.mjs` | 新建 | 上面的单测。 |
| `functions/api/proofread.js` | 改 | 换 qwen-max、收 `reference`、改用 `buildProofreadPrompt`；`MAX_CHARS` 逻辑扩展到 reference。 |
| `solutions/demo/proofreader.html` | 改 | 更新 `CATS`；加参考资料上传 + 提取 + 传参；加「原文（已标注）」高亮面板。 |
| `docs/TOOLS.md` | 改 | 记录语义深化 + 参考资料对照 + 模型。 |

## 8. 测试

- **纯函数**（`node --test`）：
  - `buildProofreadPrompt`：含各语义分类关键词；含正文；reference 非空时含"对照参考资料核查"段与 reference 内容；reference 空时不含该段（与无参考版一致）。
  - `locateSnippet`：命中返回正确 index/length；未命中返回 null；空片段/空文本安全。
  - `mergeSpans`：重叠 span 合并；相邻不误并；乱序输入排序。
  - `buildAnnotatedSegments`：段序列正确切分、highlighted 标记正确、无 span 时整段返回。
- **不单测**：语义检查质量（LLM 输出好坏）、DOM/上传/mammoth 提取——留人工验证。
- **人工验证**（镜像恢复上线后）：拿一篇真实稿 + 其访谈记录，确认① 语义三类能抓出真问题且不噪音爆炸 ② 上传参考资料后能指出与来源不符处 ③ 原文高亮定位准确、定位不到的优雅跳过。

## 9. 错误处理

- 参考资料上传失败/未上传 → 正常校对（reference 空，提示词退回无参考版）。
- 高亮片段 `indexOf` 定位不到 → 跳过该高亮，卡片照常。
- 高亮纯函数对空文本/空片段/无 span 均安全返回。
- `/api/proofread` 沿用现有 try/catch + 超时兜底（fetchWithTimeout）。
