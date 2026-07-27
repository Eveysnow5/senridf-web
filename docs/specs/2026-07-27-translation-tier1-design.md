# 翻译工具第一梯队优化 设计（术语表 + TTS 朗读 + 模型分层）

日期：2026-07-27
状态：已与用户确认方向，待写实施计划

## 1. 背景

`solutions/demo/translation.html` 是中方团队 ↔ 日本客户的会议口译 + 纪要工具（文本翻译带回訳验证、Deepgram nova-2 语音 + 流式 qwen-plus 交替传译、说话人标记、纪要导出 DOCX）。定位是"某公司专属会议口译助手"这个窄场景，不与 Google/DeepL/讯飞拼通用能力。

本期在**低成本、轻量化**前提下做三项第一梯队优化，专攻通用引擎的短板：

1. **术语表**：公司/产品/人名（千里同風、南雪、案件名等）通用引擎必翻错，用可编辑的固定译法注入 prompt 纠正——这是 DeepL 付费 glossary 的平替。
2. **译文 TTS 朗读**：现场能把日文译文读出来（跟读/放给客户听），用浏览器 `speechSynthesis`，零成本离线。
3. **模型分层降本**：语音口译短句改 qwen-turbo 降本提速，文本精译与纪要保留 qwen-plus。

并为第二梯队（会前上下文、高频短句缓存）**留出扩展点，本期不实现**。

## 2. 范围

**做**：上述三项 + 第二梯队钩子。

**明确不做（YAGNI）**：
- 会前上下文输入框、高频短句缓存的实际实现（只留入口）。
- 术语表的模糊匹配/自动提取、导入导出、多套术语表切换。
- 同声传译、更多语种。
- TTS 的自动朗读（本期只做点击朗读）、语音语速/音色设置。

## 3. 术语表

### 3.1 存储与数据模型

Firestore `glossary` 集合，每条一个文档：

| 字段 | 说明 |
|---|---|
| zh | 中文写法（如"南雪"） |
| ja | 日文写法（如"ナンシュエ"或固定汉字） |
| en | 英文写法（可空） |
| note | 备注/使用说明（可空，如"创始人，不要意译"） |
| createdAt | `serverTimestamp()` |

选 Firestore（而非随站点发布的 JSON）：改完立即生效、不依赖上线流程（当前镜像坏着，JSON 方案暂时无法更新）；与 users/visits 同一套 client-SDK 存法，一致。

### 3.2 安全规则（用户在 Firebase 控制台加）

```
match /glossary/{doc} {
  allow read: if isSignedIn();   // 翻译页需要读
  allow write: if isAdmin();     // 仅管理员增删改
}
```

### 3.3 注入机制

翻译在服务端（Cloudflare Function）发生，术语表需送达 prompt。数据流：

```
translation.html 加载
  → getDocs(collection(db,'glossary')) 拉全表存内存（术语表小，几十条）
  → 每次翻译请求 body 带上 glossary 数组（和 messages 一起）
  → Function 用纯函数 buildGlossaryPrompt(glossary, context) 生成"固定译法"段落
  → 追加进 system prompt 末尾 → 调 Qwen
```

- Function 保持无状态，不需要服务端读 Firestore（避开凭据复杂度）。
- 术语表小（整表随请求发送，约 1–2KB，可忽略）；将来若变大再在客户端按输入文本过滤相关术语（本期不做）。
- **软注入**：prompt 里写"以下专有名词请固定译作……，按语境套用其活用/格助词形式"，让模型自然应用而非死板 find-replace（后者会破坏语法）。
- `buildGlossaryPrompt` 是**纯函数**（输入术语数组 + 可选 context 字符串，输出注入文本），零依赖、可 `node --test`。放 `functions/api/_lib/buildGlossaryPrompt.js`。空术语表且空 context 时返回空串（不改变原 prompt 行为）。

### 3.4 编辑界面

在已有管理后台 `solutions/demo/admin.html` 加「术语表」板块（与 users/visits/scrape/errors 板块并列）：
- 列表展示现有术语（zh / ja / en / note + 删除按钮）。
- 一行输入（zh / ja / en / note）+「添加」按钮 → `addDoc(collection(db,'glossary'), {...})`。
- 删除 → `deleteDoc`。
- 展示时所有字段经 `escapeHtml` 转义（沿用错误面板的做法，防注入）。

## 4. TTS 朗读

- 新建 `js/shared/speak.js`，导出 `speak(text, lang)`：用 `window.speechSynthesis` + `SpeechSynthesisUtterance`，按 lang（`ja`/`zh`/`en`）设 `utterance.lang`（`ja-JP`/`zh-CN`/`en-US`）。调用前 `cancel()` 掉上一条，避免叠读。
- 导出 `ttsSupported()` → `typeof window.speechSynthesis !== 'undefined'`。
- translation.html：文本模式译文区、语音模式每条译文旁加 🔊 按钮，点击调 `speak(译文, 目标语言)`。`ttsSupported()` 为 false 时不渲染按钮。
- 目标语言判定：文本模式按输出块（日本語訳→ja、中文翻译→zh）；语音模式按当前翻译方向的目标语言。
- 零成本、离线、纯客户端，不经任何后端。

## 5. 模型分层降本

- `functions/api/translate-stream.js`：`model: 'qwen-plus'` → `'qwen-turbo'`（实时语音口译短句，turbo 更便宜、首字延迟更低，短对话质量差异小）。
- `functions/api/translate.js`（文本精译，需回訳质量）→ **保留 qwen-plus**。
- `functions/api/summary.js`（纪要生成）→ **保留 qwen-plus**。
- 纯配置改动；若 turbo 质量不满意，改回一行即可。

## 6. 第二梯队扩展点（本期只留钩子）

- **会前上下文**：`buildGlossaryPrompt(glossary, context)` 的 `context` 形参即入口。本期 translation.html 调用时 context 传空字符串；将来加"会前背景"输入框，把内容传进 body 的 `context` 字段、Function 原样透传给该函数即可，注入逻辑无需改。
- **高频短句缓存**：translation.html 里把"发起翻译请求"收敛到一个薄函数（如 `requestTranslate(payload)`），将来缓存层（按输入文本 hash 命中）在该函数内部加，调用方不变。本期该函数只是直连 fetch。

## 7. 组件/文件

| 文件 | 动作 | 职责 |
|---|---|---|
| `functions/api/_lib/buildGlossaryPrompt.js` | 新建 | 纯函数：术语数组 + context → 注入文本。可单测。 |
| `tests/build-glossary-prompt.test.mjs` | 新建 | 上面纯函数的单测。 |
| `functions/api/translate.js` | 改 | 收 body 的 `glossary`/`context`，注入 system prompt。 |
| `functions/api/translate-stream.js` | 改 | 同上注入 + `model` 改 qwen-turbo。 |
| `js/shared/speak.js` | 新建 | `speak(text,lang)` / `ttsSupported()`（speechSynthesis 封装）。 |
| `solutions/demo/translation.html` | 改 | 加载术语表、请求带 glossary、🔊 按钮、薄 `requestTranslate` wrapper。 |
| `solutions/demo/admin.html` | 改 | 「术语表」编辑面板（Firestore CRUD + 转义）。 |

## 8. 测试

- **纯函数**（`node --test`）：`buildGlossaryPrompt` —— 空表+空 context 返回空串；有术语时输出含各术语的 zh/ja/en；有 context 时输出含 context 段；只有 context 没术语、或只有术语没 context 都正确。
- **不单测**：speechSynthesis 朗读、Firestore CRUD、translation.html 与 admin 面板的 DOM 胶水——留人工验证。
- **人工验证**（镜像恢复上线后）：加一条术语（如 南雪→固定日文写法），在翻译页确认译文按术语走；点 🔊 确认日/中语音朗读；语音口译确认走 qwen-turbo 仍可用；后台增删术语生效。

## 9. 错误处理

- 术语表加载失败（Firestore 读失败/未登录）→ 内存术语表为空数组，翻译照常（`buildGlossaryPrompt` 空表返回空串，prompt 退回原样）。全 best-effort，不阻断翻译。
- `speechSynthesis` 不支持 → `ttsSupported()` 为 false，不渲染 🔊 按钮。
- Function 收到的 `glossary` 若非数组/字段缺失 → `buildGlossaryPrompt` 内部防御（过滤掉缺 zh/ja 的条目），不抛错。
