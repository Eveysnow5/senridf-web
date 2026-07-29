# 人生故事 · 访谈智能（AI 自适应追问）设计

日期：2026-07-29
状态：已与用户确认方向，待写实施计划

## 1. 背景

`solutions/demo/lifestory.html` + `/api/lifestory` 是访谈式自传工具：15 个锚点题（人生大轮廓骨架）+ BRANCHES（标签触发的**预写**追问）+ analyze（打标签/识别回避）+ bridge（过渡句）+ story（成文，事实铁律、克制白描）。

痛点：**问题难设计**。BRANCHES 是人肉维护的"标签→预写追问"映射，永远做不完，且预写题**通用、接不住受访者刚说的具体内容**——受访者说"父亲在我 12 岁走了"，工具只能按标签抛一句泛泛的"那段最难时期怎么撑过来"，问不到"父亲、12 岁"这个具体细节。真访谈者会顺着具体的话往深挖。

本期（A）：用 **AI 当场生成顺着答案的追问** 取代 BRANCHES，专门逼细节、顺带澄清逻辑、尊重回避、老人友好、继承克制taste。（B 语音输入是另一块，不在本期。）

## 2. 范围

**做**：
- 退役 BRANCHES（删预写追问表 + 标签匹配选题逻辑）。
- 加 `probe` 端点 action：一次调用完成"分析 + 生成追问或换题"。
- lifestory.html 深挖循环：每锚点最多 2 句 AI 追问（硬上限），AI 判断够了/回避就换题。

**明确不做（YAGNI）**：
- 语音输入（B，另一块）。
- 改锚点 15 题、历史情境题、bridge、story 的既有逻辑与taste。
- 换模型（保留 qwen-plus）。
- 多轮追问历史的复杂记忆结构（用现有 recentHistory 即可）。

## 3. 架构

### 3.1 退役 BRANCHES
删除 lifestory.html 里 `BRANCHES` 数组及 `pickNext` 中"优先级 2：标签匹配衍生追问"分支。深度全由 AI 追问负责；15 锚点做骨架，也是**兜底**——AI 追问失败或判断换题时，走下一锚点。（历史情境题、锚点、剩余流程保留。）

### 3.2 合并成一次 `probe` 调用
现在每轮答完调 `analyze`（返回 tags/year/location/isEvasion/…）。改为调 **`probe`**：一次调用里先分析该回答，再据分析（回避？信息够厚？）决定追问或换题。返回：
```
{
  analysis: { tags, year, location, isEvasion, evasionType, softLanding },
  followup: { ask: boolean, question: string }   // ask=false 时 question 为 ""
}
```
- 不增加网络往返（和现在一样：每轮 probe + bridge 两次调用）。
- 回避信号与追问在同一次生成——追问天然"知道对方在躲"，一致性好。
- 客户端用 `analysis` 供历史情境题匹配（year/location）与覆盖统计；用 `followup` 决定是否抛追问。

### 3.3 深挖循环 + 硬上限
- 每个锚点维护 `followupCount`（本锚点已追问次数）。
- 答完（锚点答 or 追问答）→ probe。
- `decideProbe(probeResult, followupCount, CAP=2)`：
  - 若 `followup.ask === true` 且 `followupCount < CAP` → 返回 `'ask'`（抛出 `followup.question`，`followupCount++`）。
  - 否则 → 返回 `'advance'`（`followupCount` 归零，`pickNext` 选下一锚点/历史题）。
- CAP=2 防审问疲劳（尤其老人）。

## 4. probe 提示词要点

`buildProbePrompt(question, answer, recentHistory, knownTags)` 生成 user 消息；system 提示词指导模型：
1. **先分析**：抽取 tags（沿用现有 60 词表）、year、location、isEvasion/evasionType/softLanding。
2. **再决定追问**：
   - **逼细节**：顺着受访者刚说的具体词/事，追问一个**具体的东西**——某一件事、某个场景、当时什么样、后来怎样、那一刻的感受。一次只问一个。
   - **顺带澄清**：回答含糊/跳跃/前后不清时，改成温和澄清（时间先后、指代对象、关系）。
   - **尊重回避**：`isEvasion` 为真 → 不深挖，`ask:false`（换题或给更轻松角度），绝不追问伤口。
   - **老人友好**：追问**短、具体、口语**，避免抽象/宏大提问。
   - **克制taste**：不奉承、不煽情、不"你真勇敢/谢谢分享"，白描。沿用 bridge/story 调性。
   - 本锚点信息已足够厚 / 已问到位 → `ask:false`（由模型判断，客户端再用 CAP 兜底）。
3. **严格输出 JSON**（不带代码块），字段如 §3.2。

纯函数 `buildProbePrompt` 放 `functions/api/_lib/`，可 node --test（验证含分析字段、含追问指令、含正文与历史）。

## 5. 可测纯逻辑

- `buildProbePrompt(...)`（`functions/api/_lib/lifestory-probe-prompt.js`）：结构正确。
- `decideProbe(probeResult, followupCount, cap)`（`js/shared/lifestory-probe.js`）：
  - ask=true 且未达上限 → 'ask'。
  - ask=true 但已达上限 → 'advance'。
  - ask=false → 'advance'。
  - probeResult 缺字段/非对象 → 'advance'（容错）。
- `parseProbeJson(raw)`（同 `lifestory-probe.js`）：去代码块解析；坏 JSON → 返回安全默认 `{ analysis:{...空}, followup:{ ask:false, question:'' } }`。

DOM/Firebase/网络胶水与实际访谈质量不单测，留人工验证。

## 6. 数据流

```
受访者答（锚点或追问）
  → POST /api/lifestory { action:'probe', question, answer, recentHistory, knownTags }
  → lifestory.js: buildProbePrompt → qwen-plus → JSON
  → parseProbeJson 容错解析
  → decideProbe(结果, 本锚点已追问数, 2)
     ├ 'ask'    → callBridge(答, followup.question) → 展示过渡句 + 追问；followupCount++
     └ 'advance'→ pickNext（历史题/下一锚点）→ callBridge → 展示；followupCount=0
```

## 7. 组件/文件

| 文件 | 动作 | 职责 |
|---|---|---|
| `functions/api/_lib/lifestory-probe-prompt.js` | 新建 | 纯函数 `buildProbePrompt` |
| `tests/lifestory-probe-prompt.test.mjs` | 新建 | 上面的单测 |
| `js/shared/lifestory-probe.js` | 新建 | 纯逻辑 `decideProbe` / `parseProbeJson` |
| `tests/lifestory-probe.test.mjs` | 新建 | 上面的单测 |
| `functions/api/lifestory.js` | 改 | 加 `probe` action（用 buildProbePrompt，返回 analysis+followup）；`analyze` action 原样保留不删（避免牵连，客户端主流程改调 `probe`） |
| `solutions/demo/lifestory.html` | 改 | 删 BRANCHES + 标签选题分支；改调 probe；加深挖循环 + CAP；用 decideProbe/parseProbeJson（经 module 桥接或直接 import，视 script 结构） |
| `docs/TOOLS.md` | 改 | 记录 AI 自适应追问机制 |

> 说明：lifestory.html 若为"普通 `<script>` + 独立 module"双块结构（同 translation/analysis），纯模块需在 module 块 import 后经 `window` 桥接给普通块用；实施时先 Read 确认。

## 8. 测试

- **纯函数**（node --test）：`buildProbePrompt`（含分析字段名、追问指令、正文/历史注入）；`decideProbe`（四种分支）；`parseProbeJson`（正常/代码块包裹/坏 JSON 容错）。
- **不单测**：追问质量（LLM 输出好坏）、DOM/流程——留人工验证。
- **人工验证**（镜像恢复上线后）：走一遍真实访谈——① 追问是否顺着具体内容、逼出细节 ② 回避时是否不硬追 ③ 每锚点追问不超过 2 句 ④ 含糊回答能否被澄清 ⑤ 老人视角问题是否够短够具体。

## 9. 错误处理

- probe 请求失败 / 坏 JSON → `parseProbeJson` 返回安全默认（ask:false）→ `decideProbe` 判 'advance' → 走下一锚点，访谈不中断。
- CAP=2 硬上限防追问失控。
- 回避（isEvasion）与隐私（answer 的 `privacy` 标记，story 阶段保持空白）均尊重，不变。
