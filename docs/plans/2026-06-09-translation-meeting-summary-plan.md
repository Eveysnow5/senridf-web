# 翻译工具升级 · 会议口译 + 纪要自动化 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级现有翻译工具，添加发言人标记（"我说"/"对方说"）和会议纪要自动化生成，支持结构化纪要输出和 Word 文档导出。

**Architecture:** 
- 前端（translation.html）：添加发言人标记按钮，管理 `currentMarker` 状态，每条转录自动关联标记，修改历史显示以展示发言人颜色标签。
- 后端（新增 summary.js）：接收转录对话 + 标记，调用 Qwen 生成结构化纪要 JSON，使用 `docx` 库生成 Word 文档，返回下载链接。
- 流程：会议进行中一键标记 → 会议结束点"生成纪要" → 后端处理 30-60 秒 → 下载 DOCX。

**Tech Stack:** 
- 前端：Web Speech API、Deepgram（已有）、Qwen 翻译（已有）
- 后端：Netlify Functions、Node.js、Qwen API、`docx` npm 库
- 数据：JSON 对话 + 标记 → 纪要 JSON → DOCX

---

## 文件结构

**修改的文件:**
- `solutions/demo/translation.html` — 前端发言人标记 + 纪要生成 UI

**新增的文件:**
- `netlify/functions/summary.js` — 纪要生成和 DOCX 导出的后端接口

**package.json 新增依赖:**
- `docx` — Word 文档生成库

---

## 阶段 1：前端发言人标记（2-3 小时）

### Task 1.1: 修改转录数据结构，添加 marker 字段

**Files:**
- Modify: `solutions/demo/translation.html`（JavaScript 部分，状态初始化）

**背景:** 现有转录记录只有 `speaker`（甲/乙 from Deepgram）、`zh`、`ja`、`timestamp`。需要添加 `marker` 字段来记录用户标记的"我说"/"对方说"。

- [ ] **Step 1: 找到状态初始化代码**

打开 `solutions/demo/translation.html`，搜索 Voice mode 的状态初始化代码（通常在 `<script>` 标签下，查找 `voiceStream` 或 `state` 相关初始化）。

预期找到类似：
```javascript
const state = {
  isRecording: false,
  dialogues: []
};
```

- [ ] **Step 2: 添加 currentMarker 状态**

在状态初始化中添加 `currentMarker` 字段，用来追踪当前选中的发言人标记。修改为：

```javascript
const state = {
  isRecording: false,
  dialogues: [],
  currentMarker: "我说"  // 新增：默认从"我说"开始
};
```

- [ ] **Step 3: 修改转录历史添加逻辑**

找到转录记录被添加到 `state.dialogues` 的代码（通常在 Deepgram 或转录回调中）。

现有逻辑可能是：
```javascript
state.dialogues.push({
  speaker: transData.speaker,
  zh: translatedText.zh,
  ja: translatedText.ja,
  timestamp: Date.now()
});
```

改为：
```javascript
state.dialogues.push({
  speaker: transData.speaker,
  marker: state.currentMarker,  // 新增：自动关联当前的发言人标记
  zh: translatedText.zh,
  ja: translatedText.ja,
  timestamp: Date.now()
});
```

- [ ] **Step 4: 测试状态改动**

在浏览器的 DevTools Console 中验证：
```javascript
console.log(state.dialogues[0]);
// 应输出包含 marker 字段的对象
```

- [ ] **Step 5: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: add marker field to transcription data structure"
```

---

### Task 1.2: 修改转录历史显示，添加发言人颜色标签

**Files:**
- Modify: `solutions/demo/translation.html`（HTML 和 CSS）

**背景:** 当前转录历史显示每条转录，但没有发言人身份的视觉区分。需要在每条转录前添加一个颜色标签，"我说"用绿色，"对方说"用蓝色。

- [ ] **Step 1: 找到转录历史的显示代码**

搜索构建转录历史 HTML 的代码（通常在处理 Deepgram 转录回调的地方，或者有一个叫 `renderDialogue` / `appendDialogue` / `displayTranscript` 的函数）。

预期找到类似：
```javascript
const transcriptHtml = `
  <div class="voice-transcript-item">
    <div class="transcript-text">
      <span class="transcript-zh">${zh}</span>
      <span class="transcript-ja">${ja}</span>
    </div>
  </div>
`;
elVoiceStream.insertAdjacentHTML('beforeend', transcriptHtml);
```

- [ ] **Step 2: 添加发言人标签 HTML**

改为：
```javascript
const markerColor = item.marker === "我说" ? "#22c55e" : "#3b82f6";  // 绿色 vs 蓝色
const markerLabel = item.marker === "我说" ? "🟢 我说" : "🔵 对方说";

const transcriptHtml = `
  <div class="voice-transcript-item" data-marker="${item.marker}">
    <div class="transcript-marker" style="background-color: ${markerColor};">
      ${markerLabel}
    </div>
    <div class="transcript-text">
      <span class="transcript-zh">${item.zh}</span>
      <span class="transcript-ja">${item.ja}</span>
    </div>
  </div>
`;
elVoiceStream.insertAdjacentHTML('beforeend', transcriptHtml);
```

- [ ] **Step 3: 添加 CSS 样式（如果没有）**

在 `<style>` 标签中添加：
```css
.voice-transcript-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--c-border-light);
}

.transcript-marker {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
}

.transcript-text {
  flex: 1;
}

.transcript-zh {
  display: block;
  font-family: var(--f-sans);
  font-size: 0.95rem;
  color: var(--c-text);
  line-height: 1.6;
  margin-bottom: 4px;
}

.transcript-ja {
  display: block;
  font-family: var(--f-serif);
  font-size: 0.9rem;
  color: var(--c-text-2);
  line-height: 1.6;
}
```

- [ ] **Step 4: 在浏览器中测试显示**

打开翻译工具的 Voice Tab，进行一次语音输入，验证转录历史中是否显示了颜色标签。预期见到：
```
🟢 我说  [转录内容]
🔵 对方说  [转录内容]
```

- [ ] **Step 5: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: add speaker marker labels to transcript history display"
```

---

### Task 1.3: 改造"甲""乙"按钮为"我说"/"对方说"

**Files:**
- Modify: `solutions/demo/translation.html`（HTML 和 CSS）

**背景:** 现有的 `btnA` 和 `btnB` 按钮显示为"甲"和"乙"，需要改造为"🟢 我说"和"🔵 对方说"，并改变样式以显示当前选中状态。

- [ ] **Step 1: 找到按钮 HTML**

搜索 Voice Tab 中的按钮定义，预期找到：
```html
<button type="button" class="ci-btn" id="btnA" disabled>
  <span class="ci-spk">甲</span>
  <span class="ci-lang">日本語</span>
  <span class="ci-status">発言する</span>
</button>
<button type="button" class="ci-btn" id="btnB" disabled>
  <span class="ci-spk">乙</span>
  <span class="ci-lang">中文</span>
  <span class="ci-status">发言</span>
</button>
```

- [ ] **Step 2: 修改按钮文本和 ID**

改为：
```html
<button type="button" class="ci-btn ci-btn--marker" id="btnMarkerMe" disabled title="我说话时按此按钮 / 我が話す場合、このボタンを押す">
  <span class="ci-marker-icon">🟢</span>
  <span class="ci-marker-label">我说</span>
  <span class="ci-marker-status" id="markerMeStatus">未选中</span>
</button>
<button type="button" class="ci-btn ci-btn--marker" id="btnMarkerThem" disabled title="对方说话时按此按钮 / 相手が話す場合、このボタンを押す">
  <span class="ci-marker-icon">🔵</span>
  <span class="ci-marker-label">对方说</span>
  <span class="ci-marker-status" id="markerThemStatus">未选中</span>
</button>
```

- [ ] **Step 3: 添加 CSS 样式**

在 `<style>` 中添加或修改（如果 `.ci-btn` 已有样式，就扩展它）：
```css
.ci-btn--marker {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px;
  border: 2px solid var(--c-border);
  background: var(--c-surface);
  cursor: pointer;
  transition: all 0.2s;
}

.ci-btn--marker:hover:not(:disabled) {
  border-color: var(--c-accent);
  background: var(--c-accent-light);
}

.ci-btn--marker.is-active {
  border-color: var(--c-accent);
  background: var(--c-accent-light);
  font-weight: 500;
}

.ci-marker-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.ci-marker-label {
  font-family: var(--f-sans);
  font-size: 0.875rem;
  font-weight: 500;
}

.ci-marker-status {
  font-family: var(--f-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  color: var(--c-text-3);
  text-transform: uppercase;
}
```

- [ ] **Step 4: 测试按钮外观**

刷新浏览器，验证按钮显示正确。预期见到两个按钮，分别显示"🟢 我说"和"🔵 对方说"。

- [ ] **Step 5: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: redesign marker buttons as '我说' and '对方说' with visual indicators"
```

---

### Task 1.4: 实现按钮点击逻辑，管理 currentMarker 状态

**Files:**
- Modify: `solutions/demo/translation.html`（JavaScript 部分）

**背景:** 按钮需要有点击事件处理器，切换 `state.currentMarker` 的值，并更新按钮的视觉状态（高亮）。

- [ ] **Step 1: 找到现有的按钮事件处理代码**

搜索 `btnA` 或 `btnB` 的事件监听（通常在 `addEventListener` 或事件委托代码中）。

预期找到类似：
```javascript
document.getElementById('btnA').addEventListener('click', () => {
  // 处理甲说话
});
```

- [ ] **Step 2: 编写新的按钮点击处理器**

在适当的地方添加以下代码（可以替换旧的处理器）：

```javascript
const btnMarkerMe = document.getElementById('btnMarkerMe');
const btnMarkerThem = document.getElementById('btnMarkerThem');
const markerMeStatus = document.getElementById('markerMeStatus');
const markerThemStatus = document.getElementById('markerThemStatus');

function updateMarkerButtonUI() {
  // 根据 state.currentMarker 更新按钮视觉状态
  if (state.currentMarker === "我说") {
    btnMarkerMe.classList.add('is-active');
    btnMarkerThem.classList.remove('is-active');
    markerMeStatus.textContent = "已选中";
    markerThemStatus.textContent = "未选中";
  } else {
    btnMarkerMe.classList.remove('is-active');
    btnMarkerThem.classList.add('is-active');
    markerMeStatus.textContent = "未选中";
    markerThemStatus.textContent = "已选中";
  }
}

btnMarkerMe.addEventListener('click', () => {
  state.currentMarker = "我说";
  updateMarkerButtonUI();
});

btnMarkerThem.addEventListener('click', () => {
  state.currentMarker = "对方说";
  updateMarkerButtonUI();
});

// 初始化按钮状态
updateMarkerButtonUI();
```

- [ ] **Step 3: 启用按钮**

现有代码可能有 `disabled` 属性。找到启用按钮的代码（通常在 Deepgram 连接成功或语音识别准备就绪时），确保也启用了新的 marker 按钮。例如：

```javascript
// 原有：
btnA.disabled = false;
btnB.disabled = false;

// 改为：
btnMarkerMe.disabled = false;
btnMarkerThem.disabled = false;
```

- [ ] **Step 4: 测试按钮交互**

打开 Voice Tab，进行语音识别，点击"我说"和"对方说"按钮，验证：
1. 按钮高亮状态正确切换
2. 按钮的状态文本更新
3. 控制台中 `state.currentMarker` 的值正确改变：
   ```javascript
   console.log(state.currentMarker);  // 应输出"我说"或"对方说"
   ```

- [ ] **Step 5: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: implement marker button click handlers and state management"
```

---

### Task 1.5: 验证转录自动标记

**Files:**
- No new files

**背景:** 这一步验证之前在 Task 1.1 中添加的"自动标记"逻辑是否工作正常。当有新的转录来临时，应自动关联当前的 `state.currentMarker`。

- [ ] **Step 1: 进行端到端测试**

1. 打开 Voice Tab
2. 点击"我说"按钮，进行一次语音输入（说一个短句）
3. 等待转录和翻译完成
4. 查看转录历史，验证显示的是"🟢 我说"标签
5. 点击"对方说"按钮，进行另一次语音输入
6. 查看转录历史，验证新的转录显示"🔵 对方说"标签

- [ ] **Step 2: 检查 localStorage（如果有持久化）**

如果代码中有保存转录到 localStorage，打开 DevTools，检查 Application → LocalStorage，验证保存的数据中包含 `marker` 字段：

```javascript
// 在 Console 中执行
JSON.parse(localStorage.getItem('voiceDialogues')).forEach(d => {
  console.log(d.marker, d.zh);
});
// 应输出类似：
// "我说" "产品支持实时处理"
// "对方说" "成本怎样"
```

- [ ] **Step 3: 刷新页面，验证状态恢复**

如果有草稿恢复机制（lifestory 工具有），刷新页面后，验证转录历史中的标记是否正确恢复。

- [ ] **Step 4: Commit（如果有测试代码）**

如果没有测试代码，这一步就是验证。如果有自动化测试需要更新，执行：

```bash
git add [test files]
git commit -m "test: verify automatic speaker marker assignment"
```

如果没有，跳过 commit，继续到下一阶段。

---

## 阶段 2：后端纪要生成 + DOCX 导出（4-5 小时）

### Task 2.1: 新建 summary.js 并实现基础接口框架

**Files:**
- Create: `netlify/functions/summary.js`

**背景:** 新增后端接口用于生成会议纪要。接口应接收一个对话列表（包含 marker、zh、ja），调用 Qwen API 进行分析，返回结构化的纪要（topics、feedback、actions）。

- [ ] **Step 1: 创建 summary.js 文件**

```bash
touch netlify/functions/summary.js
```

- [ ] **Step 2: 编写基础框架**

```javascript
const QWEN_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// Qwen API 调用函数（可复用 lifestory.js 中的 qwen 函数逻辑）
async function qwen(system, user, maxTokens = 1500, temp = 0.5) {
  const key = process.env.QWEN_API_KEY;
  if (!key) throw new Error('未配置 API Key');
  
  const res = await fetch(QWEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),  // 30 秒超时
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${key}` 
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: system }, 
        { role: 'user', content: user }
      ],
      max_tokens: maxTokens,
      temperature: temp,
    }),
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `API ${res.status}`);
  return data.choices[0].message.content.trim();
}

// ── HTTP 处理器 ──
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { 
    body = JSON.parse(event.body); 
  } catch { 
    return { statusCode: 400, body: JSON.stringify({ error: '请求格式错误' }) }; 
  }

  const headers = { 'Content-Type': 'application/json' };

  try {
    const { dialogues } = body;
    if (!Array.isArray(dialogues) || dialogues.length === 0) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: '缺少 dialogues 数组' }) 
      };
    }

    // TODO: 调用 Qwen 生成纪要
    // TODO: 生成 DOCX 文件
    
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };

  } catch (err) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
};
```

- [ ] **Step 3: 测试基础框架**

部署到 Netlify（或本地测试），使用 curl 或 Postman 发送请求：

```bash
curl -X POST http://localhost:3001/.netlify/functions/summary \
  -H "Content-Type: application/json" \
  -d '{"dialogues": [{"marker": "我说", "zh": "test", "ja": "test"}]}'

# 预期返回：
# {"message":"OK"}
```

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/summary.js
git commit -m "feat: create summary endpoint scaffold with basic framework"
```

---

### Task 2.2: 实现 Qwen 调用，生成结构化纪要 JSON

**Files:**
- Modify: `netlify/functions/summary.js`

**背景:** 使用 Qwen API 分析双语对话，自动提取议题（topics）、客户反馈（feedback）、行动项（actions），返回结构化 JSON。

- [ ] **Step 1: 编写纪要生成 Prompt**

在 summary.js 顶部添加 system prompt：

```javascript
const SYS_SUMMARY =
  '你是会议纪要专家，擅长从双语对话（中文和日文）中提取关键信息。\n\n' +
  '任务：分析以下中日双语对话，生成结构化的会议纪要。\n\n' +
  '请按以下 JSON 格式输出（不要代码块，直接输出）：\n' +
  '{\n' +
  '  "topics": [...],           // 列表：识别的主要议题（3-5 个）\n' +
  '  "feedback": [...],         // 列表：客户的反馈和顾虑（3-5 条）\n' +
  '  "actions": [...]           // 列表：行动项，包含谁、做什么、到什么时间\n' +
  '}\n\n' +
  '要求：\n' +
  '· topics：从对话中归纳主要讨论主题，用简洁的名词短语\n' +
  '· feedback：提取客户（"对方说"部分）明确表达的兴趣点、问题、顾虑\n' +
  '· actions：识别对话中双方的承诺或计划\n' +
  '  - 格式：{ "actor": "我们" 或 "客户", "task": "具体任务", "deadline": "时间" }\n' +
  '  - 如果没有明确的时间，可写 "待定"\n' +
  '· 禁止编造、推断或猜测。只提取对话中明确说出的内容\n' +
  '· 如果对话中没有相关内容，返回空数组 []';
```

- [ ] **Step 2: 编写对话转换函数**

添加一个函数，将前端发来的 `dialogues` 转换成 Qwen 可理解的对话文本：

```javascript
function formatDialoguesForAnalysis(dialogues) {
  // 将 dialogues 数组转换成可读的对话文本
  return dialogues
    .map(d => {
      const speaker = d.marker === "我说" ? "我们" : "客户";
      return `【${speaker}】\n中文：${d.zh}\n日文：${d.ja}`;
    })
    .join('\n\n');
}
```

- [ ] **Step 3: 在 handler 中调用 Qwen 生成纪要**

修改 `exports.handler` 中的 `try` 块，替换 `TODO` 注释：

```javascript
try {
  const { dialogues } = body;
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ error: '缺少 dialogues 数组' }) 
    };
  }

  // 格式化对话
  const dialogueText = formatDialoguesForAnalysis(dialogues);
  const userPrompt = `以下是会议对话：\n\n${dialogueText}`;
  
  // 调用 Qwen 生成纪要
  const rawSummary = await qwen(SYS_SUMMARY, userPrompt, 1500, 0.5);
  
  // 解析 JSON
  let summary;
  try {
    const cleaned = rawSummary
      .replace(/```(?:json)?\n?/g, '')
      .replace(/```/g, '')
      .trim();
    summary = JSON.parse(cleaned);
  } catch (parseErr) {
    // 如果 JSON 解析失败，返回空结构
    console.error('JSON parse error:', parseErr.message);
    summary = {
      topics: [],
      feedback: [],
      actions: []
    };
  }

  // TODO: 生成 DOCX 文件

  return { statusCode: 200, headers, body: JSON.stringify({ summary }) };

} catch (err) {
  return { 
    statusCode: 500, 
    headers, 
    body: JSON.stringify({ error: err.message }) 
  };
}
```

- [ ] **Step 4: 测试 Qwen 调用**

发送一个测试请求（包含样本对话）：

```bash
curl -X POST http://localhost:3001/.netlify/functions/summary \
  -H "Content-Type: application/json" \
  -d '{
    "dialogues": [
      {
        "marker": "我说",
        "zh": "我们的产品可以实时处理大数据",
        "ja": "当社の製品は大規模データをリアルタイムで処理できます"
      },
      {
        "marker": "对方说",
        "zh": "这很有意思，成本怎样？",
        "ja": "それは興味深いですね。コストはいくらですか？"
      }
    ]
  }'

# 预期返回：
# {
#   "summary": {
#     "topics": ["实时数据处理能力", "产品定价"],
#     "feedback": ["对实时处理功能感兴趣", "关注产品成本"],
#     "actions": []
#   }
# }
```

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/summary.js
git commit -m "feat: implement Qwen API call for meeting summary generation"
```

---

### Task 2.3: 安装 docx 库并实现 Word 文档生成

**Files:**
- Modify: `netlify/functions/summary.js`、`package.json`

**背景:** 使用 `docx` npm 库生成结构化的 Word 文档（.docx）。文档包含纪要的议题、反馈、行动项等内容，格式清晰易读。

- [ ] **Step 1: 安装 docx 库**

```bash
cd netlify/functions
npm install docx
# 或者在项目根目录：
npm install docx
```

验证 `package.json` 或 `netlify/functions/package.json` 中添加了 `"docx": "^x.x.x"`。

- [ ] **Step 2: 在 summary.js 顶部导入 docx**

```javascript
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } = require('docx');
const fs = require('fs');
const path = require('path');
```

- [ ] **Step 3: 编写 DOCX 生成函数**

```javascript
async function generateDocx(summary, dialogues) {
  // 生成 Word 文档
  const doc = new Document({
    sections: [{
      children: [
        // 标题
        new Paragraph({
          text: '会议纪要',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          spacing: { after: 400 }
        }),
        
        // 基础信息
        new Paragraph({
          text: `日期：${new Date().toLocaleDateString('zh-CN')}`,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `参与者：中国团队、日本客户`,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `时长：约 ${Math.ceil(dialogues.length / 10)} 分钟`,
          spacing: { after: 400 }
        }),
        
        // 议题
        new Paragraph({
          text: '【议题】',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          spacing: { after: 200 }
        }),
        ...(summary.topics || []).map(topic => 
          new Paragraph({
            text: `• ${topic}`,
            spacing: { after: 100 }
          })
        ),
        ...(summary.topics && summary.topics.length === 0 ? [
          new Paragraph({
            text: '（无）',
            spacing: { after: 200 }
          })
        ] : [new Paragraph({ text: '', spacing: { after: 200 } })]),
        
        // 客户反馈
        new Paragraph({
          text: '【客户反馈】',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          spacing: { after: 200 }
        }),
        ...(summary.feedback || []).map(fb => 
          new Paragraph({
            text: `• ${fb}`,
            spacing: { after: 100 }
          })
        ),
        ...(summary.feedback && summary.feedback.length === 0 ? [
          new Paragraph({
            text: '（无）',
            spacing: { after: 200 }
          })
        ] : [new Paragraph({ text: '', spacing: { after: 200 } })]),
        
        // 行动项
        new Paragraph({
          text: '【行动项】',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          spacing: { after: 200 }
        }),
        
        // 按 actor 分组显示行动项
        ...generateActionSections(summary.actions || []),
      ]
    }]
  });
  
  // 生成 DOCX 文件到临时目录
  const tempDir = '/tmp';
  const filename = `summary_${Date.now()}.docx`;
  const filepath = path.join(tempDir, filename);
  
  const bytes = await Packer.toBuffer(doc);
  fs.writeFileSync(filepath, bytes);
  
  return { filename, filepath };
}

function generateActionSections(actions) {
  const sections = [];
  
  if (!actions || actions.length === 0) {
    sections.push(new Paragraph({
      text: '（无）',
      spacing: { after: 200 }
    }));
    return sections;
  }
  
  // 按 actor 分组
  const grouped = {};
  actions.forEach(action => {
    const actor = action.actor || '未分配';
    if (!grouped[actor]) grouped[actor] = [];
    grouped[actor].push(action);
  });
  
  // 生成每个 actor 的section
  Object.entries(grouped).forEach(([actor, items]) => {
    sections.push(new Paragraph({
      text: `${actor}：`,
      bold: true,
      spacing: { after: 100 }
    }));
    
    items.forEach(action => {
      sections.push(new Paragraph({
        text: `  ☐ ${action.task}${action.deadline ? `（${action.deadline}）` : ''}`,
        spacing: { after: 100 }
      }));
    });
    
    sections.push(new Paragraph({
      text: '',
      spacing: { after: 200 }
    }));
  });
  
  return sections;
}
```

- [ ] **Step 4: 修改 handler 调用 DOCX 生成**

在 handler 中，替换第二个 `TODO` 注释：

```javascript
// 生成 DOCX 文件
const { filename, filepath } = await generateDocx(summary, dialogues);

// 返回文件信息（前端可用来下载）
return { 
  statusCode: 200, 
  headers, 
  body: JSON.stringify({ 
    summary, 
    docxUrl: `/.netlify/functions/download-docx?file=${filename}`
  }) 
};
```

**注意**：如果 Netlify Functions 不支持直接文件下载，我们可能需要用 Base64 编码返回文件内容，或者建一个单独的 `/download-docx` 函数。后续 Task 2.4 中会处理这个。

- [ ] **Step 5: 测试 DOCX 生成**

再次发送测试请求，验证返回中包含 `docxUrl`：

```bash
curl -X POST http://localhost:3001/.netlify/functions/summary \
  -H "Content-Type: application/json" \
  -d '{"dialogues": [{"marker": "我说", "zh": "test", "ja": "test"}]}'

# 预期返回中包含 "docxUrl" 字段
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/summary.js package.json
git commit -m "feat: implement Word document generation with docx library"
```

---

### Task 2.4: 实现文件下载接口和错误处理

**Files:**
- Modify: `netlify/functions/summary.js`（或新建 `netlify/functions/download-docx.js`）

**背景:** 需要一个机制让前端能下载生成的 DOCX 文件。同时添加完善的错误处理（超时、API 失败等）和日志记录。

- [ ] **Step 1: 选择文件传输方案**

有两个方案：
- **方案 A**：在 summary 接口中直接返回 Base64 编码的文件内容，前端用 `blob` 下载
- **方案 B**：保存 DOCX 到服务器临时存储，返回下载链接

使用**方案 A**（更简单，不依赖服务器存储）：

- [ ] **Step 2: 修改 DOCX 生成函数，返回 Base64**

```javascript
async function generateDocxBase64(summary, dialogues) {
  // 生成 Word 文档（同 Task 2.3）
  const doc = new Document({
    sections: [{
      children: [ /* ... 同 Task 2.3 ... */ ]
    }]
  });
  
  const bytes = await Packer.toBuffer(doc);
  const base64 = bytes.toString('base64');
  
  return base64;
}
```

- [ ] **Step 3: 修改 handler 返回 Base64**

```javascript
// 生成 DOCX 的 Base64 编码
const docxBase64 = await generateDocxBase64(summary, dialogues);

return { 
  statusCode: 200, 
  headers, 
  body: JSON.stringify({ 
    summary,
    docxBase64,  // 新增：Base64 编码的 DOCX 文件
    docxFilename: `summary_${Date.now()}.docx`
  }) 
};
```

- [ ] **Step 4: 添加错误处理**

完善 handler 的 catch 块，区分不同错误：

```javascript
} catch (err) {
  // 区分不同类型的错误
  let statusCode = 500;
  let errorMsg = err.message;
  
  if (err.message.includes('API')) {
    statusCode = 503;
    errorMsg = 'Qwen API 调用失败，请稍后重试';
  } else if (err.message.includes('timeout')) {
    statusCode = 504;
    errorMsg = '生成超时，请检查网络后重试';
  } else if (err.message.includes('缺少')) {
    statusCode = 400;
  }
  
  console.error('[summary.js]', err);  // 日志记录
  
  return { 
    statusCode, 
    headers, 
    body: JSON.stringify({ error: errorMsg }) 
  };
}
```

- [ ] **Step 5: 添加超时和重试保护**

在 Qwen 调用中，已有 `AbortSignal.timeout(30000)`。验证代码中有这行。如果没有，添加：

```javascript
const res = await fetch(QWEN_URL, {
  method: 'POST',
  signal: AbortSignal.timeout(30000),  // 30 秒超时
  // ... 其他配置
});
```

- [ ] **Step 6: 测试错误处理**

1. 故意发送错误的请求（缺少 dialogues），验证返回 400：
   ```bash
   curl -X POST http://localhost:3001/.netlify/functions/summary \
     -H "Content-Type: application/json" \
     -d '{}'
   # 预期返回 400: 缺少 dialogues 数组
   ```

2. 发送正常请求，验证返回 200 并包含 `docxBase64`：
   ```bash
   curl -X POST http://localhost:3001/.netlify/functions/summary \
     -H "Content-Type: application/json" \
     -d '{"dialogues": [{"marker": "我说", "zh": "test", "ja": "test"}]}'
   # 预期返回 200: {"summary": {...}, "docxBase64": "..."}
   ```

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/summary.js
git commit -m "feat: add docx Base64 export and comprehensive error handling"
```

---

### Task 2.5: 后端接口集成测试

**Files:**
- No new files

**背景:** 测试完整的后端流程：接收对话 → 调用 Qwen → 生成纪要 JSON → 生成 DOCX → 返回给前端。

- [ ] **Step 1: 准备测试数据**

创建一个包含完整对话的测试请求。保存为 `test_summary.json`：

```json
{
  "dialogues": [
    {
      "marker": "我说",
      "zh": "我们的产品采用最新的 AI 技术，可以实时分析大规模数据。",
      "ja": "当社の製品は最新のAI技術を採用し、大規模データをリアルタイムで分析できます。"
    },
    {
      "marker": "对方说",
      "zh": "这很有意思。你们的产品能处理日文数据吗？",
      "ja": "それは面白いですね。貴社の製品は日本語データを処理できますか？"
    },
    {
      "marker": "我说",
      "zh": "完全可以。我们已经在多个日本企业中成功应用。",
      "ja": "もちろんです。当社は既に複数の日本企業で成功事例があります。"
    },
    {
      "marker": "对方说",
      "zh": "那太好了。接下来，我们想看一个演示，还有定价信息。",
      "ja": "それはいいですね。次は、デモンストレーションと価格情報を見たいのですが。"
    },
    {
      "marker": "我说",
      "zh": "没问题。我们可以在一周内提供完整的 Demo 和定价表。",
      "ja": "わかりました。1週間以内に完全なデモと価格表を提供できます。"
    }
  ]
}
```

- [ ] **Step 2: 发送完整测试请求**

```bash
curl -X POST http://localhost:3001/.netlify/functions/summary \
  -H "Content-Type: application/json" \
  -d @test_summary.json
```

预期返回：
```json
{
  "summary": {
    "topics": ["AI 技术能力", "日文数据处理", "Demo 和定价"],
    "feedback": ["对产品感兴趣", "想要 Demo 演示", "需要定价信息"],
    "actions": [
      {
        "actor": "我们",
        "task": "提供完整的 Demo 和定价表",
        "deadline": "1 周内"
      },
      {
        "actor": "客户",
        "task": "评审 Demo 和定价信息",
        "deadline": "待定"
      }
    ]
  },
  "docxBase64": "UEsDBBQABgA...",  // 长 Base64 字符串
  "docxFilename": "summary_1718001234.docx"
}
```

- [ ] **Step 3: 验证返回的 DOCX 文件**

将返回的 Base64 解码并保存为 Word 文件，验证内容正确：

```bash
# 在 JavaScript 中（或用其他工具）
const base64 = "UEsDBBQA...";  // 从上面的返回结果
const buffer = Buffer.from(base64, 'base64');
require('fs').writeFileSync('test_summary.docx', buffer);

# 然后用 Word 打开 test_summary.docx，验证格式和内容
```

- [ ] **Step 4: 检查日志输出**

在服务器日志中验证没有错误信息。如果有错误，根据错误信息调整代码。

- [ ] **Step 5: Commit**

```bash
git add test_summary.json
git commit -m "test: add end-to-end backend integration test for summary generation"
```

---

## 阶段 3：前端 UI 集成（2-3 小时）

### Task 3.1: 新增"生成纪要"按钮和确认对话

**Files:**
- Modify: `solutions/demo/translation.html`

**背景:** 在 Voice Tab 的操作区域（现有的"清空"按钮旁）添加"生成纪要"按钮。点击时弹出确认对话，防止误操作。

- [ ] **Step 1: 找到现有的操作按钮区域**

搜索 Voice Tab 中的"清空"按钮（通常在 `ci-side-btns` 或类似的 div 中），预期找到：

```html
<div class="ci-side-btns">
  <button type="button" class="tl-action-btn tl-action-btn--primary" id="voiceTts" title="朗读 / 朗読">🔊</button>
  <button type="button" class="tl-action-btn tl-action-btn--primary" id="voiceSummary" disabled>摘要</button>
  <button type="button" class="tl-action-btn tl-action-btn--ghost" id="voiceClear">クリア</button>
</div>
```

- [ ] **Step 2: 添加"生成纪要"按钮**

修改上面的代码，添加新按钮：

```html
<div class="ci-side-btns">
  <button type="button" class="tl-action-btn tl-action-btn--primary" id="voiceTts" title="朗读 / 朗読">🔊</button>
  <button type="button" class="tl-action-btn tl-action-btn--primary" id="voiceGenSummary" disabled title="生成会议纪要">📝 生成纪要</button>
  <button type="button" class="tl-action-btn tl-action-btn--ghost" id="voiceClear">クリア</button>
</div>
```

**注意**：如果已有的 `voiceSummary` 按钮是用来做别的，就保留它；如果是空的或重名，就用新的 ID `voiceGenSummary`。

- [ ] **Step 3: 新增 HTML 模态对话框**

在页面底部（或 Voice Tab 的任何地方）添加确认对话框：

```html
<div id="summaryConfirmDialog" class="dialog-overlay" style="display: none;">
  <div class="dialog-box">
    <div class="dialog-header">
      <h3>生成会议纪要</h3>
    </div>
    <div class="dialog-body">
      <p>确定要生成纪要吗？生成后，当前的转录记录将被保存。</p>
      <p style="font-size: 0.875rem; color: var(--c-text-3); margin-top: 12px;">
        生成纪要需要 30-60 秒，期间请勿关闭页面。
      </p>
    </div>
    <div class="dialog-footer">
      <button type="button" class="btn-cancel" id="summaryConfirmCancel">取消</button>
      <button type="button" class="btn-confirm" id="summaryConfirmOk">确定</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: 添加 CSS 样式**

在 `<style>` 标签中添加对话框样式：

```css
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-box {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  padding: 0;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--c-border-light);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.dialog-body {
  padding: 20px 24px;
  font-family: var(--f-sans);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--c-text);
}

.dialog-body p {
  margin: 0;
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--c-border-light);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  padding: 10px 20px;
  font-family: var(--f-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: none;
  color: var(--c-text-3);
  border: 1px solid var(--c-border);
}

.btn-cancel:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.btn-confirm {
  background: var(--c-accent);
  color: var(--c-surface);
}

.btn-confirm:hover {
  opacity: 0.85;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 5: 测试按钮和对话框显示**

在浏览器中验证：
1. 进行一次语音输入，使得转录不为空
2. "生成纪要"按钮应该启用（如果之前是 disabled）
3. 点击"生成纪要"，对话框应显示
4. 点击"取消"，对话框关闭

- [ ] **Step 6: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: add summary generation button and confirmation dialog"
```

---

### Task 3.2: 实现后端调用和生成状态管理

**Files:**
- Modify: `solutions/demo/translation.html`

**背景:** 当用户确认生成纪要时，前端收集所有的转录（含 marker），调用后端 `/functions/summary` 接口。显示加载状态（旋转图标 + "生成中..."），处理成功和失败情况。

- [ ] **Step 1: 获取 DOM 元素引用**

在 JavaScript 中找到合适的位置（通常在页面加载后的初始化代码），添加：

```javascript
const elGenSummaryBtn = document.getElementById('voiceGenSummary');
const elSummaryDialog = document.getElementById('summaryConfirmDialog');
const elSummaryConfirmOk = document.getElementById('summaryConfirmOk');
const elSummaryConfirmCancel = document.getElementById('summaryConfirmCancel');
```

- [ ] **Step 2: 实现打开/关闭对话框的函数**

```javascript
function showSummaryDialog() {
  elSummaryDialog.style.display = 'flex';
}

function closeSummaryDialog() {
  elSummaryDialog.style.display = 'none';
}
```

- [ ] **Step 3: 实现后端调用函数**

```javascript
async function callSummaryApi(dialogues) {
  try {
    const response = await fetch('/.netlify/functions/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dialogues })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API 错误: ${response.status}`);
    }

    const result = await response.json();
    return result;  // 包含 summary、docxBase64、docxFilename
  } catch (err) {
    console.error('Summary API error:', err);
    throw err;
  }
}
```

- [ ] **Step 4: 实现生成纪要的主逻辑**

```javascript
async function generateSummary() {
  if (!state.dialogues || state.dialogues.length === 0) {
    alert('没有转录记录，无法生成纪要');
    return;
  }

  closeSummaryDialog();
  
  // 显示加载状态
  elGenSummaryBtn.disabled = true;
  const originalText = elGenSummaryBtn.textContent;
  elGenSummaryBtn.innerHTML = '<div class="tl-spinner" style="display: inline-block;"></div> 生成中...';
  
  try {
    // 调用后端
    const result = await callSummaryApi(state.dialogues);
    
    // 保存纪要到状态（供后续使用）
    state.currentSummary = result.summary;
    state.docxData = {
      base64: result.docxBase64,
      filename: result.docxFilename
    };
    
    // 显示成功消息和下载按钮
    showSummaryResult(result);
    
  } catch (err) {
    alert('生成纪要失败：' + err.message + '，请稍后重试');
    console.error(err);
  } finally {
    // 恢复按钮状态
    elGenSummaryBtn.disabled = false;
    elGenSummaryBtn.innerHTML = originalText;
  }
}
```

- [ ] **Step 5: 绑定按钮事件**

```javascript
// "生成纪要"按钮点击
elGenSummaryBtn.addEventListener('click', () => {
  showSummaryDialog();
});

// 对话框"确定"按钮
elSummaryConfirmOk.addEventListener('click', () => {
  generateSummary();
});

// 对话框"取消"按钮
elSummaryConfirmCancel.addEventListener('click', () => {
  closeSummaryDialog();
});

// 点击对话框外部关闭（可选）
elSummaryDialog.addEventListener('click', (e) => {
  if (e.target === elSummaryDialog) {
    closeSummaryDialog();
  }
});
```

- [ ] **Step 6: 启用"生成纪要"按钮**

找到启用语音按钮的代码（通常在 Deepgram 连接成功时），添加：

```javascript
// 原有代码中，当启用 btnMarkerMe、btnMarkerThem 时，也启用：
elGenSummaryBtn.disabled = false;
```

- [ ] **Step 7: 测试后端调用**

1. 进行一次完整的语音识别和翻译
2. 点击"生成纪要"按钮
3. 在对话框中点击"确定"
4. 验证按钮显示"生成中..."，30-60 秒后恢复
5. 检查浏览器控制台，验证 API 返回的数据中包含 `summary` 和 `docxBase64`

- [ ] **Step 8: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: implement summary API integration and generation state management"
```

---

### Task 3.3: 显示纪要结果和下载链接

**Files:**
- Modify: `solutions/demo/translation.html`

**背景:** 纪要生成成功后，显示一个结果面板，包含议题、反馈、行动项的摘要，以及"下载纪要（Word）"按钮。用户点击下载，DOCX 文件保存到本地。

- [ ] **Step 1: 新增纪要结果显示区域的 HTML**

在页面中添加（可在 Voice Tab 底部）：

```html
<div id="summaryResultPanel" style="display: none; margin-top: 32px; padding: 20px; background: var(--c-bg-alt); border: 1px solid var(--c-border);">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <h3 style="margin: 0; font-size: 1rem; font-weight: 500;">生成的会议纪要</h3>
    <button type="button" class="tl-action-btn tl-action-btn--ghost" id="summaryClosePanelBtn">✕ 关闭</button>
  </div>
  
  <div id="summaryContent" style="margin-bottom: 20px;">
    <!-- 纪要内容将动态填充到这里 -->
  </div>
  
  <div style="display: flex; gap: 12px;">
    <button type="button" class="tl-action-btn tl-action-btn--primary" id="summaryDownloadBtn">
      💾 下载纪要（Word）
    </button>
    <button type="button" class="tl-action-btn tl-action-btn--ghost" id="summaryNewMeetingBtn">
      ➕ 新建会议
    </button>
  </div>
</div>
```

- [ ] **Step 2: 实现纪要内容的 HTML 生成函数**

```javascript
function formatSummaryHtml(summary) {
  const topics = (summary.topics || []).length > 0
    ? summary.topics.map(t => `<li>${escapeHtml(t)}</li>`).join('')
    : '<li style="color: var(--c-text-3);">（无）</li>';
  
  const feedback = (summary.feedback || []).length > 0
    ? summary.feedback.map(f => `<li>${escapeHtml(f)}</li>`).join('')
    : '<li style="color: var(--c-text-3);">（无）</li>';
  
  const actions = (summary.actions || []).length > 0
    ? summary.actions
        .map(a => `<li><strong>${escapeHtml(a.actor)}</strong>: ${escapeHtml(a.task)}${a.deadline ? `（${escapeHtml(a.deadline)}）` : ''}</li>`)
        .join('')
    : '<li style="color: var(--c-text-3);">（无）</li>';
  
  return `
    <div style="margin-bottom: 16px;">
      <h4 style="margin: 0 0 8px; font-size: 0.95rem; font-weight: 500;">【议题】</h4>
      <ul style="margin: 0; padding-left: 20px;">${topics}</ul>
    </div>
    
    <div style="margin-bottom: 16px;">
      <h4 style="margin: 0 0 8px; font-size: 0.95rem; font-weight: 500;">【客户反馈】</h4>
      <ul style="margin: 0; padding-left: 20px;">${feedback}</ul>
    </div>
    
    <div>
      <h4 style="margin: 0 0 8px; font-size: 0.95rem; font-weight: 500;">【行动项】</h4>
      <ul style="margin: 0; padding-left: 20px;">${actions}</ul>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 3: 实现 showSummaryResult 函数**

修改之前 Task 3.2 中的 `showSummaryResult` 占位符：

```javascript
function showSummaryResult(result) {
  const elPanel = document.getElementById('summaryResultPanel');
  const elContent = document.getElementById('summaryContent');
  
  // 填充纪要内容
  elContent.innerHTML = formatSummaryHtml(result.summary);
  
  // 显示面板
  elPanel.style.display = 'block';
  
  // 滚动到面板
  elPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```

- [ ] **Step 4: 实现下载 DOCX 的函数**

```javascript
function downloadDocx(base64, filename) {
  // 将 Base64 转换为 Blob
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  
  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: 绑定结果面板的按钮事件**

```javascript
const elSummaryDownloadBtn = document.getElementById('summaryDownloadBtn');
const elSummaryClosePanelBtn = document.getElementById('summaryClosePanelBtn');
const elSummaryNewMeetingBtn = document.getElementById('summaryNewMeetingBtn');

// 下载纪要
elSummaryDownloadBtn.addEventListener('click', () => {
  if (state.docxData) {
    downloadDocx(state.docxData.base64, state.docxData.filename);
  }
});

// 关闭面板
elSummaryClosePanelBtn.addEventListener('click', () => {
  document.getElementById('summaryResultPanel').style.display = 'none';
});

// 新建会议（清空转录）
elSummaryNewMeetingBtn.addEventListener('click', () => {
  if (confirm('确定要清空转录记录吗？')) {
    state.dialogues = [];
    state.currentSummary = null;
    state.docxData = null;
    document.getElementById('voiceStream').innerHTML = '';
    document.getElementById('summaryResultPanel').style.display = 'none';
  }
});
```

- [ ] **Step 6: 测试纪要显示和下载**

1. 完成纪要生成（Task 3.2 的测试）
2. 验证结果面板显示议题、反馈、行动项
3. 点击"下载纪要（Word）"
4. 验证浏览器下载了一个 .docx 文件
5. 用 Word 打开下载的文件，检查内容和格式

- [ ] **Step 7: Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: display summary results and implement DOCX download"
```

---

### Task 3.4: 集成测试和 UI 优化

**Files:**
- No new files（可能有小的 CSS/HTML 调整）

**背景:** 进行完整的端到端测试，确保整个流程（标记发言人 → 生成纪要 → 下载 DOCX）正确工作。修复任何 UI bug 或不一致之处。

- [ ] **Step 1: 完整的端到端流程测试**

1. 打开翻译工具的 Voice Tab
2. 点击"🟢 我说"按钮
3. 进行一次语音输入（说一个短句子）
4. 等待转录和翻译完成
5. 验证转录历史中显示"🟢 我说"标签
6. 点击"🔵 对方说"按钮
7. 进行另一次语音输入
8. 验证新转录显示"🔵 对方说"标签
9. 重复 2-8 几次，构建完整的对话
10. 点击"生成纪要"按钮
11. 在确认对话框中点击"确定"
12. 等待 30-60 秒，验证按钮显示"生成中..."
13. 生成完成后，验证结果面板显示议题、反馈、行动项
14. 点击"下载纪要"，验证 Word 文件下载成功
15. 用 Word 打开文件，检查格式和内容

预期结果：所有步骤都应无错误地完成，Word 文件内容清晰完整。

- [ ] **Step 2: 错误场景测试**

1. 不进行任何语音输入，直接点击"生成纪要" → 应显示错误信息"没有转录记录"
2. 生成过程中刷新页面 → 应中断生成，之前的转录保留（如有草稿机制）
3. 网络断开时生成纪要 → 应显示错误"生成纪要失败，请稍后重试"

- [ ] **Step 3: UI 一致性检查**

1. 按钮颜色、大小、间距是否与现有 UI 一致
2. 对话框的样式是否与现有的样式系统相符
3. 纪要面板的字体、颜色是否清晰易读
4. 在不同窗口大小下，UI 是否正确响应（mobile/desktop）

如有不一致，进行小的 CSS 调整。

- [ ] **Step 4: 浏览器兼容性检查**

在以下浏览器中测试（至少 Chrome 和 Edge）：
- Chrome（最新版本）
- Edge（最新版本）
- Safari（如可用）

验证所有功能都能正常工作。

- [ ] **Step 5: 性能和日志检查**

1. 打开 DevTools → Network 标签，监控 `/functions/summary` 的请求
2. 验证请求体大小合理（通常 < 100KB）
3. 响应时间在 30-60 秒内
4. Console 中没有 JavaScript 错误
5. 没有 404 或其他 HTTP 错误

- [ ] **Step 6: 清理和最后调整**

如果发现任何 bug，修复后 commit。如果没有，进行最后的 commit。

- [ ] **Step 7: 最终 Commit**

```bash
git add solutions/demo/translation.html
git commit -m "feat: complete end-to-end integration testing and UI optimization"
```

---

## 总结和后续

所有任务完成后，翻译工具应具备：
- ✅ 发言人一键标记（"我说"/"对方说"）
- ✅ 转录历史的发言人颜色标签
- ✅ 会议结束后一键生成结构化纪要
- ✅ 纪要包含议题、反馈、行动项
- ✅ 可下载的 Word 文档（.docx）

**可选的后续功能**（不在本计划范围内）：
- 发言时长统计
- 术语库管理
- 邮件发送纪要
- 多语言支持扩展

---

