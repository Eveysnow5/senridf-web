# 翻译工具第一梯队优化 实施计划（术语表 + TTS + 模型分层）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给翻译工具加可编辑术语表（注入 prompt）、文本模式译文 TTS 朗读、语音口译改用更便宜的 qwen-turbo，并为第二梯队留钩子。

**Architecture:** 术语表存 Firestore、前端加载后随请求送给 Cloudflare Function、由纯函数 `buildGlossaryPrompt` 注入 system prompt；TTS 抽 `js/shared/speak.js`（语音模式本已有 TTS，本次抽共享 + 文本模式加 🔊）；模型分层仅改端点配置。

**Tech Stack:** Cloudflare Pages Functions、Qwen（DashScope）、Firebase Firestore、浏览器 speechSynthesis、`node:test`。纯静态零构建。

**部署说明：** 镜像坏着，线上人工验证挂账。本地闸门 `npm run check`。translation.html 里 plain `<script>` 与底部 `<script type="module">` 通过 `window.*` 通信（已有 `window.sdfGetToken` 先例）。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `functions/api/_lib/buildGlossaryPrompt.js` | 新建 | 纯函数：术语数组 + context → prompt 注入文本 |
| `tests/build-glossary-prompt.test.mjs` | 新建 | 上面的单测 |
| `functions/api/translate.js` | 改 | 注入 glossary/context |
| `functions/api/translate-stream.js` | 改 | 注入 + model 改 qwen-turbo |
| `js/shared/speak.js` | 新建 | `speak(text,lang)` / `ttsSupported()` |
| `solutions/demo/translation.html` | 改 | 加载术语表、requestTranslate、传参、暴露 speak、文本🔊、状态文案 |
| `solutions/demo/admin.html` | 改 | 术语表编辑面板 |
| `docs/TOOLS.md` | 改 | 记录术语表机制 + Firestore 规则 |

---

## Task 1: 纯函数 buildGlossaryPrompt（TDD）

**Files:**
- Create: `functions/api/_lib/buildGlossaryPrompt.js`
- Test: `tests/build-glossary-prompt.test.mjs`

- [ ] **Step 1: 写失败测试** — 创建 `tests/build-glossary-prompt.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGlossaryPrompt } from '../functions/api/_lib/buildGlossaryPrompt.js';

test('空术语表 + 空 context 返回空串（不改变原 prompt）', () => {
  assert.equal(buildGlossaryPrompt([], ''), '');
  assert.equal(buildGlossaryPrompt(undefined, undefined), '');
});

test('有术语时输出含各术语的中/日/英', () => {
  const out = buildGlossaryPrompt(
    [{ zh: '南雪', ja: 'ナンシュエ', en: 'Nanxue', note: '创始人' }],
    '',
  );
  assert.match(out, /南雪/);
  assert.match(out, /ナンシュエ/);
  assert.match(out, /Nanxue/);
  assert.match(out, /创始人/);
});

test('过滤掉缺 zh 或 ja 的条目', () => {
  const out = buildGlossaryPrompt(
    [
      { zh: '有效', ja: 'ゆうこう' },
      { zh: '', ja: 'なし' },
      { zh: '缺日文', ja: '' },
      { ja: '没有中文' },
    ],
    '',
  );
  assert.match(out, /有效/);
  assert.doesNotMatch(out, /なし/);
  assert.doesNotMatch(out, /缺日文/);
});

test('只有 context 没术语时输出含 context 段', () => {
  const out = buildGlossaryPrompt([], '本次会议讨论硬件采购');
  assert.match(out, /本次会议讨论硬件采购/);
});

test('非数组 glossary 不抛错、返回空串', () => {
  assert.equal(buildGlossaryPrompt('not-an-array', ''), '');
  assert.equal(buildGlossaryPrompt(null, ''), '');
});

test('en/note 缺省时不报错', () => {
  const out = buildGlossaryPrompt([{ zh: '案件', ja: '案件' }], '');
  assert.match(out, /案件/);
});
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`，报找不到模块。

- [ ] **Step 3: 写实现** — 创建 `functions/api/_lib/buildGlossaryPrompt.js`：

```js
// 纯函数：术语表 + 会前上下文（第二梯队钩子）→ 追加进 system prompt 的注入文本。
// 零依赖，可 node --test。空表且空 context 返回空串（不改变原 prompt 行为）。
export function buildGlossaryPrompt(glossary, context = '') {
  const terms = Array.isArray(glossary) ? glossary.filter((t) => t && t.zh && t.ja) : [];
  const parts = [];
  if (terms.length > 0) {
    const lines = terms.map((t) => {
      const en = t.en ? ` / English: ${t.en}` : '';
      const note = t.note ? `（${t.note}）` : '';
      return `- 中文「${t.zh}」= 日本語「${t.ja}」${en}${note}`;
    });
    parts.push(
      'The following are fixed translations for proper nouns (company/product/people names, domain terms). ' +
        'Always render these terms with their given equivalent, adapting inflection and particles to context. ' +
        'Apply in whichever direction matches the source and target language:\n' +
        lines.join('\n'),
    );
  }
  if (context && context.trim()) {
    parts.push(
      'Meeting context (background for disambiguation only, do not translate or output this):\n' +
        context.trim(),
    );
  }
  return parts.length > 0 ? '\n\n' + parts.join('\n\n') : '';
}
```

- [ ] **Step 4: 跑测试确认通过** — `npm test`，新增 6 条全 PASS。

- [ ] **Step 5: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write functions/api/_lib/buildGlossaryPrompt.js tests/build-glossary-prompt.test.mjs` 后再跑。

- [ ] **Step 6: 提交**
```bash
git add functions/api/_lib/buildGlossaryPrompt.js tests/build-glossary-prompt.test.mjs
git commit -m "feat(translation): 术语表注入纯函数 buildGlossaryPrompt + 单测"
```

---

## Task 2: 两个翻译端点接入注入 + stream 换 qwen-turbo

**Files:**
- Modify: `functions/api/translate.js`
- Modify: `functions/api/translate-stream.js`

- [ ] **Step 1: translate.js 接入注入**

在文件顶部已有的 `import { fetchWithTimeout } ...` 下一行加：
```js
import { buildGlossaryPrompt } from './_lib/buildGlossaryPrompt.js';
```

把解构 `const { messages } = body;` 改为：
```js
const { messages, glossary, context } = body;
```

把调用 Qwen 时的 `messages` 数组里的 system 内容拼上注入。当前是：
```js
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
```
改为：
```js
        messages: [
          { role: 'system', content: systemPrompt + buildGlossaryPrompt(glossary, context) },
          ...messages,
        ],
```

- [ ] **Step 2: translate-stream.js 接入注入 + 换模型**

顶部 `import { fetchWithTimeout } ...` 下一行加：
```js
import { buildGlossaryPrompt } from './_lib/buildGlossaryPrompt.js';
```

把解构 `const { messages, direction = 'ja-zh' } = body;` 改为：
```js
const { messages, direction = 'ja-zh', glossary, context } = body;
```

把 `const systemPrompt = ciBase + (dirMap[direction] || ...);` 之后使用的 system 内容拼上注入——即把请求体里的：
```js
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
```
改为：
```js
          messages: [
            { role: 'system', content: systemPrompt + buildGlossaryPrompt(glossary, context) },
            ...messages,
          ],
```

同一请求体里把模型换掉：
```js
          model: 'qwen-plus',
```
改为：
```js
          model: 'qwen-turbo',
```

- [ ] **Step 3: 跑闸门** — `npm run check` 全绿（注意 eslint 对新 import；prettier 格式）。

- [ ] **Step 4: 提交**
```bash
git add functions/api/translate.js functions/api/translate-stream.js
git commit -m "feat(translation): 端点注入术语表；语音口译改 qwen-turbo 降本"
```

---

## Task 3: TTS 共享模块 speak.js

**Files:**
- Create: `js/shared/speak.js`

- [ ] **Step 1: 写实现** — 创建 `js/shared/speak.js`：

```js
// 浏览器 TTS 朗读封装（speechSynthesis）。零成本、离线、纯客户端。
// 语音口译模式原本就有内联 TTS，这里抽成共享供文本模式复用、统一语言映射。
const LANG_TTS = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };

export function ttsSupported() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function speak(text, lang) {
  if (!ttsSupported() || !text) return;
  window.speechSynthesis.cancel(); // 取消上一条，避免叠读
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = LANG_TTS[lang] || 'zh-CN';
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}
```

- [ ] **Step 2: 跑闸门** — `npm run check` 全绿。prettier 报格式则 `npx prettier --write js/shared/speak.js` 后再跑。

- [ ] **Step 3: 提交**
```bash
git add js/shared/speak.js
git commit -m "feat(translation): 共享 TTS 封装 speak.js"
```

---

## Task 4: translation.html 集成（术语表 + TTS + 状态文案）

**Files:**
- Modify: `solutions/demo/translation.html`

先 Read 该文件，记住：plain `<script>`（约 949 行起，含 `apiFetch`/`doTranslate`/`renderOutput`/`sendToTranslate`/`speakText`）与底部 `<script type="module">`（约 1854 行起，含 `import { auth, db }`/`mountAuthGate`/`trackVisit`）。

- [ ] **Step 1: 底部 module 脚本——加载术语表 + 暴露 speak/TTS 到 window**

在底部 `<script type="module">` 的 import 区加两行：
```js
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { speak, ttsSupported } from '/js/shared/speak.js';
```

在 `mountAuthGate({...});` 调用**之后**加：
```js
window.sdfSpeak = speak;
window.sdfTtsSupported = ttsSupported;
window.sdfGlossary = [];
getDocs(collection(db, 'glossary'))
  .then((snap) => {
    window.sdfGlossary = snap.docs.map((d) => d.data());
  })
  .catch(() => {});
```

- [ ] **Step 2: plain 脚本——加 requestTranslate 薄 wrapper**

在 plain `<script>` 里 `apiFetch` 函数定义之后加：
```js
// 所有翻译请求经此：注入术语表 + 会前上下文（context 为第二梯队钩子，暂空）。
// 将来高频缓存层可在此按 bodyObj 命中缓存，调用方不变。
async function requestTranslate(endpoint, bodyObj, extraOpts = {}) {
  return apiFetch(endpoint, {
    method: 'POST',
    ...extraOpts,
    headers: { 'Content-Type': 'application/json', ...(extraOpts.headers || {}) },
    body: JSON.stringify({ glossary: window.sdfGlossary || [], context: '', ...bodyObj }),
  });
}
```

- [ ] **Step 3: plain 脚本——三处翻译调用改走 requestTranslate**

① 文本模式 `doTranslate` 里：
```js
        const res = await apiFetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: conversationHistory })
        });
```
改为：
```js
        const res = await requestTranslate(API_ENDPOINT, { messages: conversationHistory });
```

② 摘要触发（elSummary 点击处，同样 POST 到 API_ENDPOINT 的那处，约 1599 行）——把该处的
```js
        const res = await apiFetch(API_ENDPOINT, {
```
起的整个 fetch 调用同样改为 `requestTranslate(API_ENDPOINT, { messages: ... })`，保持它原本发送的 body 字段不变（把原 body 里的对象作为 bodyObj 传入）。

③ 语音模式 `sendToTranslate` 里（约 1321 行）：
```js
        const res = await apiFetch('/api/translate-stream', {
          method: 'POST',
          signal: activeFetchCtrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: text }],
            direction: dir
          })
        });
```
改为：
```js
        const res = await requestTranslate(
          '/api/translate-stream',
          { messages: [{ role: 'user', content: text }], direction: dir },
          { signal: activeFetchCtrl.signal },
        );
```

- [ ] **Step 4: plain 脚本——speakText 改用共享 speak**

把现有：
```js
    function speakText(text, lang) {
      if (!window.speechSynthesis || !ttsOn) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = LANG_TTS[lang] || 'zh-CN';
      utt.rate = 0.95;
      window.speechSynthesis.speak(utt);
    }
```
改为：
```js
    function speakText(text, lang) {
      if (!ttsOn) return; // 语音模式的 🔊/🔇 开关
      window.sdfSpeak?.(text, lang);
    }
```
若改完后 `LANG_TTS` 常量在 plain 脚本里不再被任何地方引用，删掉它的定义（消除死代码）；若仍被别处用则保留。

- [ ] **Step 5: plain 脚本——文本模式译文加 🔊 按钮**

在 `renderOutput(raw)` 里，`blocks.forEach` 循环内构造 `w`（`tl-block`）的地方，给"译文"类块（`block.type === 'trans'`）加一个 🔊 按钮。把：
```js
        const w = document.createElement('div');
        w.className = `tl-block tl-block--${block.type}`;
        w.innerHTML = `
          <div class="tl-block__label">${escapeHtml(block.label)}</div>
          <div class="tl-block__text">${escapeHtml(block.text)}</div>`;
        elOutputContent.appendChild(w);
```
改为：
```js
        const w = document.createElement('div');
        w.className = `tl-block tl-block--${block.type}`;
        const ttsBtn =
          block.type === 'trans' && window.sdfTtsSupported?.()
            ? `<button type="button" class="tl-speak-btn" title="朗读 / 読み上げ">🔊</button>`
            : '';
        w.innerHTML = `
          <div class="tl-block__label">${escapeHtml(block.label)}${ttsBtn}</div>
          <div class="tl-block__text">${escapeHtml(block.text)}</div>`;
        if (ttsBtn) {
          const lang = block.label === '日本語訳' ? 'ja' : block.label === '中文翻译' ? 'zh' : 'en';
          w.querySelector('.tl-speak-btn').addEventListener('click', () =>
            window.sdfSpeak?.(block.text, lang),
          );
        }
        elOutputContent.appendChild(w);
```

在页面 `<style>` 里加一条按钮样式（复用现有配色，随手即可）：
```css
    .tl-speak-btn { border:none;background:none;cursor:pointer;font-size:13px;margin-left:6px;opacity:.55;transition:opacity .15s; }
    .tl-speak-btn:hover { opacity:1; }
```

- [ ] **Step 6: 更新语音状态文案（模型分层后不再是 Qwen-Plus）**

`setVoiceStatusBusy` 里 `'Deepgram · Qwen-Plus · 準備完了'` 改为 `'Deepgram · Qwen-Turbo · 準備完了'`。（页面别处 798/861 行的营销文案「Qwen-Plus」是否改可选，本步不强制。）

- [ ] **Step 7: 跑闸门** — `npm run check` 全绿。若 `qa:css` 报 Tailwind 不同步则 `npm run build:css` 并把 `css/tailwind.min.css` 一并提交（本页非 Tailwind 页，通常不触发）；prettier 报格式则 `npx prettier --write solutions/demo/translation.html` 后再跑。

- [ ] **Step 8: 提交**
```bash
git add solutions/demo/translation.html
git commit -m "feat(translation): 接入术语表注入、文本模式🔊朗读、语音状态文案改 Turbo"
```

---

## Task 5: admin.html 术语表编辑面板

**Files:**
- Modify: `solutions/demo/admin.html`

先 Read 该文件：已有 `escapeHtml`（错误面板任务加的）、`collection/getDocs/query/orderBy/limit/doc` 等 import、`onAuthStateChanged` 管理员通过分支（`loadUsers(); loadScrapeStatus(); loadErrors(); await loadData();`）。

- [ ] **Step 1: 补 Firestore import**

确认 module 脚本的 firestore import 里含 `addDoc`、`deleteDoc`、`serverTimestamp`；缺哪个补哪个到现有 `import { ... } from '.../firebase-firestore.js';`。

- [ ] **Step 2: 加面板 markup**

在「错误日志」卡片之后（或「招标抓取监控」附近，与其它 `.card` 并列）插入：
```html
  <!-- Glossary -->
  <div class="card mb-6">
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm font-medium text-gray-700">术语表</div>
      <button onclick="loadGlossary()" type="button" class="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">↻ 刷新</button>
    </div>
    <div class="flex flex-wrap gap-2 mb-3">
      <input id="gl-zh" type="text" title="中文" placeholder="中文" class="border border-gray-200 rounded px-2 py-1 text-xs" />
      <input id="gl-ja" type="text" title="日本語" placeholder="日本語" class="border border-gray-200 rounded px-2 py-1 text-xs" />
      <input id="gl-en" type="text" title="English" placeholder="English（可空）" class="border border-gray-200 rounded px-2 py-1 text-xs" />
      <input id="gl-note" type="text" title="备注" placeholder="备注（可空）" class="border border-gray-200 rounded px-2 py-1 text-xs flex-1 min-w-[120px]" />
      <button onclick="addTerm()" type="button" class="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">添加</button>
    </div>
    <div id="gl-error" class="hidden text-xs text-red-400 mb-2"></div>
    <div class="tbl-scroll">
      <table class="w-full text-xs">
        <thead class="text-gray-400 border-b border-gray-100">
          <tr>
            <th class="text-left py-2 pr-4 font-normal">中文</th>
            <th class="text-left py-2 pr-4 font-normal">日本語</th>
            <th class="text-left py-2 pr-4 font-normal">English</th>
            <th class="text-left py-2 pr-4 font-normal">备注</th>
            <th class="text-left py-2 font-normal"></th>
          </tr>
        </thead>
        <tbody id="glTable">
          <tr><td colspan="5" class="py-4 text-center text-gray-400">加载中…</td></tr>
        </tbody>
      </table>
    </div>
  </div>
```

- [ ] **Step 3: 加 loadGlossary / renderGlossary / addTerm / deleteTerm**

在 module 脚本里（与 loadErrors 同层）加入。**所有展示字段经 `escapeHtml`**（该函数已存在）：
```js
window.loadGlossary = async function () {
  const body = document.getElementById('glTable');
  try {
    const snap = await getDocs(query(collection(db, 'glossary'), orderBy('createdAt', 'desc')));
    renderGlossary(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    console.error(e);
    body.innerHTML =
      '<tr><td colspan="5" class="py-4 text-center text-red-400">加载失败，请检查 Firestore 规则</td></tr>';
  }
};

function renderGlossary(terms) {
  document.getElementById('glTable').innerHTML =
    terms
      .map(
        (t) => `<tr class="hover:bg-gray-50">
      <td class="py-2 pr-4 text-gray-700">${escapeHtml(t.zh || '')}</td>
      <td class="py-2 pr-4 text-gray-700">${escapeHtml(t.ja || '')}</td>
      <td class="py-2 pr-4 text-gray-500">${escapeHtml(t.en || '')}</td>
      <td class="py-2 pr-4 text-gray-400">${escapeHtml(t.note || '')}</td>
      <td class="py-2"><button type="button" onclick="deleteTerm('${escapeHtml(t.id)}')" class="text-red-400 hover:text-red-600">删除</button></td>
    </tr>`,
      )
      .join('') ||
    '<tr><td colspan="5" class="py-4 text-center text-gray-400">暂无术语</td></tr>';
}

window.addTerm = async function () {
  const zh = document.getElementById('gl-zh').value.trim();
  const ja = document.getElementById('gl-ja').value.trim();
  const en = document.getElementById('gl-en').value.trim();
  const note = document.getElementById('gl-note').value.trim();
  const errEl = document.getElementById('gl-error');
  errEl.classList.add('hidden');
  if (!zh || !ja) {
    errEl.textContent = '中文和日本語为必填';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    await addDoc(collection(db, 'glossary'), { zh, ja, en, note, createdAt: serverTimestamp() });
    ['gl-zh', 'gl-ja', 'gl-en', 'gl-note'].forEach((id) => (document.getElementById(id).value = ''));
    loadGlossary();
  } catch (e) {
    errEl.textContent = '添加失败：' + e.message;
    errEl.classList.remove('hidden');
  }
};

window.deleteTerm = async function (id) {
  if (!confirm('确认删除该术语？')) return;
  try {
    await deleteDoc(doc(db, 'glossary', id));
    loadGlossary();
  } catch (e) {
    console.error(e);
  }
};
```

- [ ] **Step 4: 登录通过后调用 loadGlossary**

在 `onAuthStateChanged` 管理员通过分支加一行 `loadGlossary();`（放在 `loadErrors();` 之后、`await loadData();` 之前）。

- [ ] **Step 5: 跑闸门** — `npm run check`。**若 `qa:css` 报 Tailwind 不同步**（新用了 `min-w-[120px]` 等）则 `npm run build:css` 并把 `css/tailwind.min.css` 一并加入提交。prettier 报格式则 `npx prettier --write solutions/demo/admin.html` 后再跑。

- [ ] **Step 6: 提交**
```bash
git add solutions/demo/admin.html css/tailwind.min.css
git commit -m "feat(translation): admin 后台术语表编辑面板（增删 + 转义防注入）"
```

---

## Task 6: 文档

**Files:**
- Modify: `docs/TOOLS.md`

- [ ] **Step 1: 记录到 TOOLS.md**（找翻译工具 / 共享模块相关小节，按现有标题层级插入；内容不删改）：

```markdown
### 翻译工具第一梯队优化（2026-07-27）

- 术语表：Firestore `glossary` 集合（`{zh, ja, en, note, createdAt}`），translation.html 加载后随请求送给 `/api/translate` 和 `/api/translate-stream`，由纯函数 `functions/api/_lib/buildGlossaryPrompt.js`（有单测）注入 system prompt（软注入、按语境套用）。后台 `solutions/demo/admin.html`「术语表」面板增删，改完立即生效。
- **需在 Firebase 控制台加规则**：`match /glossary/{doc} { allow read: if isSignedIn(); allow write: if isAdmin(); }`
- TTS：`js/shared/speak.js` 的 `speak(text,lang)`/`ttsSupported()`；语音口译本有自动朗读（ttsOn 开关），文本模式译文加了 🔊 点击朗读。
- 模型分层：`/api/translate-stream`（语音口译短句）用 qwen-turbo 降本提速；`/api/translate`（文本精译带回訳）和 `/api/summary`（纪要）保留 qwen-plus。
- 第二梯队钩子：`buildGlossaryPrompt(glossary, context)` 的 context 形参（会前上下文入口，现传空）；translation.html 的 `requestTranslate()` 薄 wrapper（高频缓存入口）。
```

- [ ] **Step 2: 跑闸门** — `npm run check` 全绿。

- [ ] **Step 3: 提交**
```bash
git add docs/TOOLS.md
git commit -m "docs(translation): 记录术语表/TTS/模型分层与所需 Firestore 规则"
```

---

## 收尾（人工，挂账镜像恢复）

- Firebase 控制台加 `glossary` 集合规则（见 Task 6）。
- 镜像恢复上线后验证：后台加一条术语（如 南雪→固定日文），翻译页确认译文按术语走；文本模式点 🔊 听日/中朗读；语音口译确认走 qwen-turbo 仍正常；后台增删术语生效。

---

## Self-Review

**1. Spec 覆盖**
- 术语表存储/规则/注入/编辑（spec §3）→ Task 1（纯函数）+ Task 2（端点注入）+ Task 4 Step1-3（加载/传参）+ Task 5（编辑面板）+ Task 6（规则文档）✅
- TTS（spec §4）→ Task 3（speak.js）+ Task 4 Step4-5（refactor speakText + 文本🔊）✅（发现语音模式已有 TTS，故为"抽共享 + 文本补 🔊"）
- 模型分层（spec §5）→ Task 2 Step2（stream 换 qwen-turbo）+ Task 4 Step6（状态文案）✅
- 第二梯队钩子（spec §6）→ context 形参（Task 1/2）+ requestTranslate wrapper（Task 4 Step2）✅
- 测试（spec §8）→ Task 1 纯函数单测；胶水层人工验证 ✅

**2. 无占位符**：各步均含完整代码或精确改动锚点。translation.html 因文件大，第 3/5 步以"现有代码块→改为"的形式给出精确前后对照。

**3. 命名一致性**：`buildGlossaryPrompt(glossary, context)`、`speak(text,lang)`/`ttsSupported()`、`requestTranslate`、`window.sdfGlossary`/`window.sdfSpeak`/`window.sdfTtsSupported`、集合名 `glossary`、字段 `zh/ja/en/note/createdAt` 全计划一致。
