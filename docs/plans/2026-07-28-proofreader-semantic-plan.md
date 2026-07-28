# 校对工具语义深化 实施计划（qwen-max + 参考资料对照 + 原文高亮）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把校对工具从"格式+浅语义"升级为深语义校对：qwen-max + 重写提示词覆盖事实逻辑/表述清晰/论证完整，支持上传参考资料对照核查，并把问题片段在原文里高亮。

**Architecture:** 提示词生成抽成纯函数 `buildProofreadPrompt(text, reference)`（可测）；高亮定位逻辑抽成纯函数模块（可测）；proofread.js 换模型、收 reference；proofreader.html 更新分类、加参考资料上传、加高亮面板。

**Tech Stack:** Cloudflare Pages Functions、Qwen（DashScope）qwen-max、mammoth（docx 提取）、`node:test`。纯静态零构建。

**部署说明：** 镜像坏着，线上人工验证挂账。本地闸门 `npm run check`。proofreader.html 全部应用逻辑在一个 `<script type="module">` 里，可直接 `import`。它是 Tailwind content 页——新增 Tailwind class 需 `npm run build:css`。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `functions/api/_lib/buildProofreadPrompt.js` | 新建 | 纯函数：text + 可选 reference → 完整提示词 |
| `tests/build-proofread-prompt.test.mjs` | 新建 | 上面的单测 |
| `js/shared/proofread-highlight.js` | 新建 | 纯逻辑：locateSnippet / mergeSpans / buildAnnotatedSegments |
| `tests/proofread-highlight.test.mjs` | 新建 | 上面的单测 |
| `functions/api/proofread.js` | 改 | 换 qwen-max、收 reference（截断）、用 buildProofreadPrompt |
| `solutions/demo/proofreader.html` | 改 | 更新 CATS、加参考资料上传、加原文高亮面板 |
| `docs/TOOLS.md` | 改 | 记录语义深化机制 |

---

## Task 1: 纯函数 buildProofreadPrompt（TDD）

**Files:**
- Create: `functions/api/_lib/buildProofreadPrompt.js`
- Test: `tests/build-proofread-prompt.test.mjs`

- [ ] **Step 1: 写失败测试** — 创建 `tests/build-proofread-prompt.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProofreadPrompt } from '../functions/api/_lib/buildProofreadPrompt.js';

test('含七类检查项与正文', () => {
  const p = buildProofreadPrompt('这是一段待校对的文稿。', '');
  for (const kw of ['一、错别字', '二、重复', '三、编辑', '四、事实与逻辑', '五、表述清晰', '六、论证完整', '七、标题']) {
    assert.match(p, new RegExp(kw));
  }
  assert.match(p, /这是一段待校对的文稿。/);
});

test('无参考资料时不含参考资料段', () => {
  const p = buildProofreadPrompt('正文', '');
  assert.doesNotMatch(p, /参考资料/);
});

test('有参考资料时含参考资料段与其内容，且四类里出现对照核查指令', () => {
  const p = buildProofreadPrompt('正文', '这是访谈记录原文。');
  assert.match(p, /参考资料/);
  assert.match(p, /这是访谈记录原文。/);
  assert.match(p, /断章取义|忠实于来源|矛盾/);
});

test('非字符串 reference 当作空、不抛错', () => {
  assert.doesNotThrow(() => buildProofreadPrompt('正文', null));
  assert.doesNotMatch(buildProofreadPrompt('正文', null), /参考资料/);
});

test('要求原文摘录原始连续片段（便于高亮定位）', () => {
  assert.match(buildProofreadPrompt('正文', ''), /连续片段|原始/);
});
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`，报找不到模块。

- [ ] **Step 3: 写实现** — 创建 `functions/api/_lib/buildProofreadPrompt.js`：

```js
// 纯函数：待校对正文 + 可选参考资料 → 校对提示词（user 消息内容）。
// 零依赖，可 node --test。reference 为空/非字符串 → 与"无参考资料"版一致（不改变原行为）。
export function buildProofreadPrompt(text, reference = '') {
  const ref = typeof reference === 'string' ? reference.trim() : '';
  const refNote = ref
    ? '此外，对照下方「参考资料」核查稿件是否忠实于来源（与来源矛盾、参考资料中没有的凭空添加、断章取义或曲解原意）。'
    : '';
  const refBlock = ref
    ? `\n\n## 参考资料（原始来源，如访谈记录）\n\n稿件应忠实于以下参考资料，请据此核查第四类。\n\n${ref}`
    : '';
  return `你是一名专业的中文新闻稿校对助手。请仔细阅读以下文稿，检查七类问题并以 Markdown 格式输出报告。只报真正要紧的问题，不要为凑数逐句挑刺。

## 检查项目

**一、错别字**
形近/音近错字；标点符号误入词语内部（如"公:约"应为"公约"）；语境明显不符的字词。

**二、重复或未完成的句子**
同一意思重复表达；明显被截断的句子；语义未完结的段落。

**三、编辑指令和插入提示**
括号内的编辑操作说明（如"(此处插入专栏1…)"）；嵌入正文的格式说明；其他发布前需清理的编辑备注。

**四、事实与逻辑一致**
数字/时间/事实前后不一致；人名/地名/机构名前后写法不统一；时间线矛盾；与常识明显不符的表述；数字/单位/百分号写法前后不一致（如混用"百分之三十"与"30%"）；缺乏依据的断言。${refNote}

**五、表述清晰**
只针对真正影响理解的问题：有歧义（可多种解读）、含糊不清、指代不明（"这/那/其"指向不清）、句子结构混乱读起来别扭、明显冗余啰嗦。表达通顺仅可微调的不要列出。

**六、论证完整**
关键信息缺失导致读者无法理解；论点缺乏支撑；前后逻辑跳跃；结论与前文脱节或站不住脚。只列真正影响文稿成立的问题。

**七、标题与正文一致性**
若文稿第一行为标题（通常是独立短句），核查它是否准确反映正文主要内容；若夸大、遗漏关键信息或与正文主旨偏差，指出冲突点。无法判断第一行是否为标题时写：> 未能识别标题，本项跳过

## 输出格式

每类用 ## 二级标题标注（如"## 一、错别字"），逐条列出：
- **原文**：\`有问题的原文片段\`
  **问题**：简要说明为什么是问题
  **建议**：修改建议（无法判断时写"需人工核实"）

「原文」请尽量摘录文稿中的原始连续片段（便于定位），不要改写。若某类无问题，写：> 未发现问题${refBlock}

## 待校对文稿

${text}`;
}
```

- [ ] **Step 4: 跑测试确认通过** — `npm test`，新增 5 条全 PASS。

- [ ] **Step 5: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write functions/api/_lib/buildProofreadPrompt.js tests/build-proofread-prompt.test.mjs` 后再跑。

- [ ] **Step 6: 提交**
```bash
git add functions/api/_lib/buildProofreadPrompt.js tests/build-proofread-prompt.test.mjs
git commit -m "feat(proofreader): 校对提示词纯函数 buildProofreadPrompt（七类+参考资料）+ 单测"
```

---

## Task 2: proofread.js 换 qwen-max + 收 reference

**Files:**
- Modify: `functions/api/proofread.js`

先 Read 现文件。当前顶部有内联 `const buildPrompt = (text) => \`…\``（约 5-45 行）、`MAX_CHARS = 20000`、`onRequest` 里读 `body.text`、`model: 'qwen-plus'`。

- [ ] **Step 1: 换 import、删内联 buildPrompt**

顶部 `import { fetchWithTimeout } from './_lib/fetchWithTimeout.js';` 下一行加：
```js
import { buildProofreadPrompt } from './_lib/buildProofreadPrompt.js';
```
删除整段内联 `const buildPrompt = (text) => \`…\`;`（从 `const buildPrompt` 到它的结尾反引号+分号）。保留 `const MAX_CHARS = 20000;`。

- [ ] **Step 2: onRequest 收 reference、截断、换模型、换 prompt**

把读取正文那段：
```js
  const text = (body.text || '').trim();
  if (!text) {
    return new Response(JSON.stringify({ error: '未提供文本' }), {
      status: 400,
    });
  }

  const truncated = text.length > MAX_CHARS;
  const input = truncated ? text.slice(0, MAX_CHARS) : text;
```
改为：
```js
  const text = (body.text || '').trim();
  if (!text) {
    return new Response(JSON.stringify({ error: '未提供文本' }), {
      status: 400,
    });
  }

  const truncated = text.length > MAX_CHARS;
  const input = truncated ? text.slice(0, MAX_CHARS) : text;

  const refRaw = typeof body.reference === 'string' ? body.reference.trim() : '';
  const refTruncated = refRaw.length > MAX_CHARS;
  const reference = refTruncated ? refRaw.slice(0, MAX_CHARS) : refRaw;
```

把请求体里：
```js
          model: 'qwen-plus',
          messages: [{ role: 'user', content: buildPrompt(input) }],
          max_tokens: 6000,
```
改为：
```js
          model: 'qwen-max',
          messages: [{ role: 'user', content: buildProofreadPrompt(input, reference) }],
          max_tokens: 6000,
```

把返回体：
```js
    return new Response(JSON.stringify({ result, truncated, char_count: text.length }), {
```
改为（多返回 `ref_truncated` 供前端提示）：
```js
    return new Response(
      JSON.stringify({ result, truncated, ref_truncated: refTruncated, char_count: text.length }),
      {
```
并相应补上闭合（原来是 `}, { headers: {...} });`，改成多一层缩进后仍闭合正确——注意把原 `{ headers: { 'Content-Type': 'application/json' } });` 调整为与新括号匹配）。**实现时以 Read 到的实际闭合为准，保证括号配平、prettier 通过。**

- [ ] **Step 3: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write functions/api/proofread.js` 后再跑。

- [ ] **Step 4: 提交**
```bash
git add functions/api/proofread.js
git commit -m "feat(proofreader): 换 qwen-max、接收参考资料对照、改用 buildProofreadPrompt"
```

---

## Task 3: 纯函数 proofread-highlight（TDD）

**Files:**
- Create: `js/shared/proofread-highlight.js`
- Test: `tests/proofread-highlight.test.mjs`

- [ ] **Step 1: 写失败测试** — 创建 `tests/proofread-highlight.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  locateSnippet,
  mergeSpans,
  buildAnnotatedSegments,
} from '../js/shared/proofread-highlight.js';

test('locateSnippet 命中返回 index/length', () => {
  assert.deepEqual(locateSnippet('abcdef', 'cd'), { index: 2, length: 2 });
});

test('locateSnippet 未命中返回 null', () => {
  assert.equal(locateSnippet('abcdef', 'xy'), null);
});

test('locateSnippet 空文本或空片段返回 null', () => {
  assert.equal(locateSnippet('', 'a'), null);
  assert.equal(locateSnippet('abc', ''), null);
  assert.equal(locateSnippet('abc', null), null);
});

test('mergeSpans 合并重叠、排序乱序输入', () => {
  const merged = mergeSpans([
    { index: 5, length: 3 },
    { index: 0, length: 3 },
    { index: 2, length: 2 },
  ]);
  // [0,3) 与 [2,4) 重叠 → [0,4)；[5,8) 独立
  assert.deepEqual(merged, [
    { index: 0, length: 4 },
    { index: 5, length: 3 },
  ]);
});

test('mergeSpans 相邻但不重叠不合并', () => {
  assert.deepEqual(mergeSpans([{ index: 0, length: 2 }, { index: 2, length: 2 }]), [
    { index: 0, length: 2 },
    { index: 2, length: 2 },
  ]);
});

test('buildAnnotatedSegments 基本切分', () => {
  const segs = buildAnnotatedSegments('abcdef', [{ index: 2, length: 2 }]);
  assert.deepEqual(segs, [
    { text: 'ab', highlighted: false },
    { text: 'cd', highlighted: true },
    { text: 'ef', highlighted: false },
  ]);
});

test('buildAnnotatedSegments 无 span 返回整段', () => {
  assert.deepEqual(buildAnnotatedSegments('abc', []), [{ text: 'abc', highlighted: false }]);
});

test('buildAnnotatedSegments span 在开头/结尾', () => {
  assert.deepEqual(buildAnnotatedSegments('abc', [{ index: 0, length: 1 }]), [
    { text: 'a', highlighted: true },
    { text: 'bc', highlighted: false },
  ]);
  assert.deepEqual(buildAnnotatedSegments('abc', [{ index: 2, length: 1 }]), [
    { text: 'ab', highlighted: false },
    { text: 'c', highlighted: true },
  ]);
});
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`，报找不到模块。

- [ ] **Step 3: 写实现** — 创建 `js/shared/proofread-highlight.js`：

```js
// 校对结果原文高亮的纯逻辑：定位片段、合并重叠 span、切成标注段序列。
// 零依赖，可 node --test；DOM 组装（<mark>/转义）留在页面。

// 在 text 里找 snippet 首次出现，返回 {index, length} 或 null。
export function locateSnippet(text, snippet) {
  if (!text || !snippet) return null;
  const i = text.indexOf(snippet);
  return i === -1 ? null : { index: i, length: snippet.length };
}

// 按 index 排序，合并重叠（含交叠）的 span；相邻但不重叠保持独立。
export function mergeSpans(spans) {
  const sorted = spans
    .filter((s) => s && s.length > 0)
    .map((s) => ({ index: s.index, length: s.length }))
    .sort((a, b) => a.index - b.index);
  const merged = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.index < last.index + last.length) {
      const end = Math.max(last.index + last.length, s.index + s.length);
      last.length = end - last.index;
    } else {
      merged.push({ index: s.index, length: s.length });
    }
  }
  return merged;
}

// 按合并后的 span 把 text 切成 [{text, highlighted}] 段序列。
export function buildAnnotatedSegments(text, spans) {
  const merged = mergeSpans(spans);
  const segs = [];
  let pos = 0;
  for (const s of merged) {
    if (s.index > pos) segs.push({ text: text.slice(pos, s.index), highlighted: false });
    segs.push({ text: text.slice(s.index, s.index + s.length), highlighted: true });
    pos = s.index + s.length;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), highlighted: false });
  if (segs.length === 0) segs.push({ text, highlighted: false });
  return segs;
}
```

- [ ] **Step 4: 跑测试确认通过** — `npm test`，新增 8 条全 PASS。

- [ ] **Step 5: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write js/shared/proofread-highlight.js tests/proofread-highlight.test.mjs` 后再跑。

- [ ] **Step 6: 提交**
```bash
git add js/shared/proofread-highlight.js tests/proofread-highlight.test.mjs
git commit -m "feat(proofreader): 原文高亮定位纯逻辑 proofread-highlight + 单测"
```

---

## Task 4: proofreader.html 集成（CATS + 参考资料上传 + 高亮面板）

**Files:**
- Modify: `solutions/demo/proofreader.html`

先 Read 该文件，记住：应用逻辑都在一个 `<script type="module">` 里（约 161 行起）；`CATS`（约 210 行，现 5 类）；`esc`（约 219 行）；主上传处理 `fileInput`（约 183 行，用 `mammoth.extractRawText`，存 `uploadedText`）；`check-btn` 点击里 POST `/api/proofread` body `{ text }`（约 445 行）；`showResults(markdown, truncated, inputText)`（约 463 行）渲染 `#results-cards`。

- [ ] **Step 1: 更新 CATS（5 类 → 7 类）**

把 `const CATS = [ … ];`（含现有 5 条）整体替换为：
```js
    const CATS = [
      { key: 'typos',   keywords: ['一、错别字'], label: '一、错别字',           short: '错别字',   badge: 'bg-red-100 text-red-700',       border: 'border-red-200',    head: 'bg-red-50' },
      { key: 'repeat',  keywords: ['二、重复'],   label: '二、重复或未完成的句子', short: '重复句',   badge: 'bg-amber-100 text-amber-700',   border: 'border-amber-200',  head: 'bg-amber-50' },
      { key: 'marks',   keywords: ['三、编辑'],   label: '三、编辑指令和插入提示', short: '编辑指令', badge: 'bg-blue-100 text-blue-700',     border: 'border-blue-200',   head: 'bg-blue-50' },
      { key: 'facts',   keywords: ['四、事实'],   label: '四、事实与逻辑一致',     short: '事实逻辑', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200', head: 'bg-purple-50' },
      { key: 'clarity', keywords: ['五、表述'],   label: '五、表述清晰',           short: '表述',     badge: 'bg-teal-100 text-teal-700',     border: 'border-teal-200',   head: 'bg-teal-50' },
      { key: 'argue',   keywords: ['六、论证'],   label: '六、论证完整',           short: '论证',     badge: 'bg-rose-100 text-rose-700',     border: 'border-rose-200',   head: 'bg-rose-50' },
      { key: 'title',   keywords: ['七、标题'],   label: '七、标题与正文一致性',   short: '标题',     badge: 'bg-green-100 text-green-700',   border: 'border-green-200',  head: 'bg-green-50' },
    ];
```

- [ ] **Step 2: import 高亮纯函数**

在该 `<script type="module">` 顶部 import 区加：
```js
import { locateSnippet, buildAnnotatedSegments } from '/js/shared/proofread-highlight.js';
```
（`mergeSpans` 由 `buildAnnotatedSegments` 内部调用，页面不直接用。）

- [ ] **Step 3: 加参考资料上传 UI**

先 Read 主上传区（`#file-input`/`#file-name`/`#file-error` 所在的输入卡片 markup）。在主输入卡片**之后、`#check-btn`（开始校对）之前**插入一段可选参考资料上传（复用现有输入卡片同款 class）：
```html
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
        <label for="ref-file-input" class="block text-sm font-medium text-gray-700 mb-1">参考资料（访谈记录等，可选）</label>
        <p class="text-xs text-gray-400 mb-2">上传后，校对会核查稿件是否忠实于该来源。支持 .docx / .txt。</p>
        <input type="file" id="ref-file-input" accept=".docx,.txt" title="上传参考资料"
          class="text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-gray-200 file:text-xs file:bg-gray-50 file:text-gray-600" />
        <span id="ref-file-name" class="ml-2 text-xs text-indigo-600"></span>
        <p id="ref-file-error" class="hidden mt-1 text-xs text-red-500"></p>
      </div>
```

- [ ] **Step 4: 参考资料上传处理**

在 `fileInput.addEventListener('change', …)` 处理之后，加参考资料的处理（复用同款提取逻辑，存到 `referenceText`）：
```js
    let referenceText = '';
    const refFileInput = document.getElementById('ref-file-input');
    const refFileName = document.getElementById('ref-file-name');
    const refFileError = document.getElementById('ref-file-error');
    refFileInput.addEventListener('change', async () => {
      const file = refFileInput.files[0];
      if (!file) return;
      refFileError.classList.add('hidden');
      refFileName.textContent = '解析中…';
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (file.name.endsWith('.txt')) {
          referenceText = new TextDecoder('utf-8').decode(arrayBuffer);
        } else {
          const result = await mammoth.extractRawText({ arrayBuffer });
          referenceText = result.value;
        }
        refFileName.textContent = `✓ ${file.name}（${referenceText.length.toLocaleString()} 字）`;
      } catch {
        refFileError.textContent = '参考资料解析失败，请尝试另存为 .txt 后上传';
        refFileError.classList.remove('hidden');
        refFileName.textContent = '';
        referenceText = '';
      }
    });
```

- [ ] **Step 5: 校对请求带上 reference**

把 `check-btn` 里的：
```js
          body: JSON.stringify({ text }),
```
改为：
```js
          body: JSON.stringify({ text, reference: referenceText }),
```

- [ ] **Step 6: 加原文高亮面板 markup**

先 Read `#results` 容器与其内 `#results-cards` 的 markup。在 `#results` 内、`#results-cards` **之前**插入：
```html
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div class="text-xs text-gray-400 mb-2">原文（已标注问题片段）</div>
          <div id="annotated-original" class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words"></div>
        </div>
```

在页面 `<style>` 里加高亮样式：
```css
    .pf-hl { background: #fef08a; border-radius: 2px; padding: 0 1px; }
```

- [ ] **Step 7: showResults 里构建高亮面板**

在 `showResults` 函数体末尾（`document.getElementById('results').scrollIntoView(...)` 之前）加：
```js
      const spans = [];
      for (const cat of CATS) {
        const sec = sections[cat.label];
        if (!sec || !sec.items) continue;
        for (const item of sec.items) {
          const loc = locateSnippet(inputText, item.original);
          if (loc) spans.push(loc);
        }
      }
      const segs = buildAnnotatedSegments(inputText, spans);
      document.getElementById('annotated-original').innerHTML = segs
        .map((s) => (s.highlighted ? `<mark class="pf-hl">${esc(s.text)}</mark>` : esc(s.text)))
        .join('');
```
（`esc` 是页面已有的转义函数，所有片段都经它，防注入。）

- [ ] **Step 8: 参考资料截断提示（可选增强）**

在 `showResults` 拿到的数据里，如果后端返回了 `ref_truncated`，可在结果摘要后追加提示。最小实现：`check-btn` 的 `showResults(data.result, data.truncated, text)` 调用处，若 `data.ref_truncated` 为真，向 `inputErr` 或结果摘要区补一句"参考资料过长已截断至 20,000 字"。**实现时以不破坏现有摘要逻辑为准，若嫌复杂可只在 console warn，属可选。**

- [ ] **Step 9: 跑闸门** — `npm run check`。**qa:css 大概率报 Tailwind 不同步**（新增 teal/rose 及 file: 等 class），执行 `npm run build:css`，把 `css/tailwind.min.css` 一并提交。prettier 报格式则 `npx prettier --write solutions/demo/proofreader.html` 后再跑。

- [ ] **Step 10: 提交**
```bash
git add solutions/demo/proofreader.html css/tailwind.min.css
git commit -m "feat(proofreader): 七类语义分类、参考资料上传对照、原文问题高亮"
```

---

## Task 5: 文档

**Files:**
- Modify: `docs/TOOLS.md`

- [ ] **Step 1: 记录到 TOOLS.md**（找校对工具相关小节，按现有加粗日期条目风格插入）：

```markdown
- **2026-07-28：语义深化**：校对工具从"格式+浅语义"升级为深语义校对。`/api/proofread` 换 qwen-max、提示词由纯函数 `functions/api/_lib/buildProofreadPrompt.js`（有单测）生成，检查项改为七类——保留 错别字/重复/编辑残留/标题一致，深化 事实与逻辑一致，新增 表述清晰/论证完整，删掉中文排版（原本 UI 也没显示、纯省 token）。支持上传「参考资料（访谈记录）」对照核查稿件是否忠实于来源（reference 字段，上限 2 万字截断）。结果区新增「原文（已标注）」面板，用 `js/shared/proofread-highlight.js`（有单测）把问题片段在原文里高亮（indexOf 定位、找不到跳过、无卡片联动）。
- 成本：qwen-max 比 qwen-plus 贵数倍，校对低频可接受；不满意可把 proofread.js 的 model 改回。
```

- [ ] **Step 2: 跑闸门** — `npm run check` 全绿。

- [ ] **Step 3: 提交**
```bash
git add docs/TOOLS.md
git commit -m "docs(proofreader): 记录语义深化（qwen-max/参考资料/高亮）"
```

---

## 收尾（人工，挂账镜像恢复）

镜像恢复上线后：拿一篇真实稿 + 其访谈记录验证——① 语义三类（事实逻辑/表述清晰/论证完整）能抓真问题且不噪音爆炸 ② 上传参考资料后能指出与来源不符处 ③ 原文高亮定位准、定位不到优雅跳过 ④ qwen-max 响应时间可接受。

---

## Self-Review

**1. Spec 覆盖**
- A 语义深化（spec §3）→ Task 1（提示词七类）+ Task 2（qwen-max）+ Task 4 Step1（CATS）✅
- B 参考资料对照（spec §4）→ Task 1（reference 分支）+ Task 2（收 reference、截断）+ Task 4 Step3-5（上传+传参）✅
- C 原文高亮简化（spec §5）→ Task 3（纯逻辑）+ Task 4 Step2/6/7（面板+构建，无联动）✅
- 测试（spec §8）→ Task 1/Task 3 纯函数单测；语义质量与 DOM 人工验证 ✅
- 容错（spec §9）→ reference 空/非字符串（Task 1 防御）、定位不到跳过（Task 4 Step7 `if (loc)`）、esc 转义（Task 4 Step7）✅

**2. 无占位符**：新模块/测试/端点改动均含完整代码。Task 2 Step2 的返回体括号闭合与 Task 4 Step3/6 的 markup 插入点标注了"以 Read 到的实际为准"，因大文件精确锚点需现场确认，但给出了完整待插入代码。

**3. 命名一致性**：`buildProofreadPrompt(text, reference)`、`locateSnippet`/`mergeSpans`/`buildAnnotatedSegments`、CATS 的 label（一、错别字 … 七、标题与正文一致性）与提示词里的 `## 一、… ## 七、` 标题严格对应、keywords（'四、事实'/'五、表述'/'六、论证'/'七、标题'）匹配、`referenceText`/`reference`/`ref_truncated` 前后一致。
