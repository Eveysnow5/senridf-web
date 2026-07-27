# 3E 观测（前端错误 + CSP 违规收集）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一个共享前端模块捕获 JS 报错 / 未处理 promise / CSP 违规，去重后写入 Firestore `errors` 集合，管理后台加面板展示。

**Architecture:** 沿用 3C visits 模式——浏览器原生事件在客户端捕获、直接用 Firebase SDK 写 Firestore，不新增任何后端端点。纯判定逻辑（指纹/docId/事件归一化）拆进可 `node --test` 的 `error-report-id.js`；DOM+Firebase 装配层 `report-error.js` 不单测。

**Tech Stack:** 静态 ESM（`<script type="module">`）、Firebase 10.14.1 Firestore SDK、`node:test`。零构建、无新依赖。

**部署说明：** 镜像当前坏着，所有"线上人工验证"挂账到镜像恢复后统一做；本地闸门是 `npm run check`。

---

## 文件结构

- **创建** `js/shared/error-report-id.js` — 纯逻辑：`errorFingerprint` / `errorDocId` / `normalizeError`。零依赖、可单测。
- **创建** `tests/error-report-id.test.mjs` — 上面三个纯函数的单测。
- **创建** `js/shared/report-error.js` — 装配层：`initErrorReporting({db})` 挂三个监听并写 Firestore。依赖 Firestore SDK + `error-report-id.js`。
- **修改** 5 个 demo 工具页 + 4 个管理/bids 页 — 各挂载 `initErrorReporting({db})`。
- **修改** `solutions/demo/admin.html` — 加「错误日志」面板 + `loadErrors()` + `escapeHtml`。
- **修改** `docs/TOOLS.md` — 记录 errors 集合、report-error 模块、需在控制台加的 Firestore 规则。

---

## Task 1: 纯逻辑模块 error-report-id.js（TDD）

**Files:**
- Create: `js/shared/error-report-id.js`
- Test: `tests/error-report-id.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `tests/error-report-id.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  errorFingerprint,
  errorDocId,
  normalizeError,
} from '../js/shared/error-report-id.js';

test('errorFingerprint：同一错误产同指纹', () => {
  const a = errorFingerprint({ type: 'js', message: 'x is not defined', source: 'a.js', line: 10 });
  const b = errorFingerprint({ type: 'js', message: 'x is not defined', source: 'a.js', line: 10 });
  assert.equal(a, b);
});

test('errorFingerprint：消息里的动态数字被归一化后仍同指纹', () => {
  const a = errorFingerprint({ type: 'js', message: 'timeout after 3000ms', source: 'a.js', line: 1 });
  const b = errorFingerprint({ type: 'js', message: 'timeout after 5000ms', source: 'a.js', line: 1 });
  assert.equal(a, b);
});

test('errorFingerprint：不同错误产不同指纹', () => {
  const a = errorFingerprint({ type: 'js', message: 'x is not defined', source: 'a.js', line: 10 });
  const b = errorFingerprint({ type: 'js', message: 'y is not a function', source: 'b.js', line: 20 });
  assert.notEqual(a, b);
});

test('errorFingerprint：指纹以类型开头，便于肉眼分辨', () => {
  const fp = errorFingerprint({ type: 'csp', message: 'script-src', source: '', line: null });
  assert.ok(fp.startsWith('csp-'));
});

test('errorDocId：格式为 指纹_YYYY-MM-DD', () => {
  const id = errorDocId('js-abc', new Date('2026-07-27T10:00:00Z'));
  assert.equal(id, 'js-abc_2026-07-27');
});

test('errorDocId：跨天产不同ID', () => {
  assert.notEqual(
    errorDocId('js-abc', new Date('2026-07-27T23:59:59Z')),
    errorDocId('js-abc', new Date('2026-07-28T00:00:01Z')),
  );
});

test('normalizeError：js 事件抽取 message/filename/lineno/colno', () => {
  const r = normalizeError('js', { message: 'boom', filename: 'a.js', lineno: 12, colno: 3 });
  assert.equal(r.type, 'js');
  assert.equal(r.message, 'boom');
  assert.equal(r.source, 'a.js');
  assert.equal(r.line, 12);
  assert.equal(r.col, 3);
});

test('normalizeError：js 资源加载失败标记为 resource 类型', () => {
  const r = normalizeError('js', { message: '', target: { tagName: 'IMG', src: '/x.png' } });
  assert.equal(r.type, 'resource');
  assert.equal(r.source, '/x.png');
});

test('normalizeError：promise 从 reason.message 取消息', () => {
  const r = normalizeError('promise', { reason: { message: 'rejected!' } });
  assert.equal(r.type, 'promise');
  assert.equal(r.message, 'rejected!');
});

test('normalizeError：promise reason 为字符串时也能取', () => {
  const r = normalizeError('promise', { reason: 'plain string reason' });
  assert.equal(r.message, 'plain string reason');
});

test('normalizeError：csp 抽取 violatedDirective/blockedURI/disposition', () => {
  const r = normalizeError('csp', {
    violatedDirective: 'script-src',
    blockedURI: 'https://evil.com/x.js',
    disposition: 'report',
    sourceFile: 'page.html',
    lineNumber: 5,
  });
  assert.equal(r.type, 'csp');
  assert.equal(r.message, 'script-src');
  assert.equal(r.extra.blockedURI, 'https://evil.com/x.js');
  assert.equal(r.extra.disposition, 'report');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: FAIL，报 `Cannot find module '../js/shared/error-report-id.js'`。

- [ ] **Step 3: 写实现**

创建 `js/shared/error-report-id.js`：

```js
// 错误上报的纯判定逻辑：指纹（去重键）、文档ID、事件归一化。
// 零依赖，可 node --test 直接测；写 Firestore 的装配层在同目录 report-error.js。
// 参照 track-visit-id.js 的分层习惯（纯逻辑可测、IO/DOM 胶水不测）。

// 轻度归一化消息：把行内数字、URL query 换成占位符，避免同一错误因动态数字/参数被算成多条。
function normalizeMessage(msg) {
  return String(msg == null ? '' : msg)
    .replace(/\?[^\s]*/g, '') // 去掉 URL query
    .replace(/\d+/g, '#') // 数字归一
    .slice(0, 300)
    .trim();
}

// 简单稳定字符串 hash（base36）。只求同输入同输出，无需加密强度。
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// 指纹：同类型 + 同（归一化后）消息 + 同来源 + 同行号 → 同指纹。以类型前缀开头便于肉眼分辨。
export function errorFingerprint({ type, message, source, line }) {
  const key = [type, normalizeMessage(message), source || '', line == null ? '' : line].join('|');
  return `${type}-${hash(key)}`;
}

// 文档ID：指纹 + 当天日期，同一错误一天去重到一条。
export function errorDocId(fingerprint, now = new Date()) {
  return `${fingerprint}_${now.toISOString().slice(0, 10)}`;
}

// 把浏览器事件（或等价的普通对象）归一化成待写入的报告对象。
export function normalizeError(kind, ev) {
  if (kind === 'js') {
    // 资源加载失败：无 message、target 是元素（img/script/link 等）
    if (ev && !ev.message && ev.target && ev.target.tagName) {
      return {
        type: 'resource',
        message: `resource load failed: ${ev.target.tagName}`,
        source: ev.target.src || ev.target.href || '',
        line: null,
        col: null,
        extra: {},
      };
    }
    return {
      type: 'js',
      message: ev.message || 'Unknown error',
      source: ev.filename || '',
      line: ev.lineno == null ? null : ev.lineno,
      col: ev.colno == null ? null : ev.colno,
      extra: {},
    };
  }
  if (kind === 'promise') {
    const reason = ev.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    return {
      type: 'promise',
      message: message || 'Unhandled rejection',
      source: '',
      line: null,
      col: null,
      extra: {},
    };
  }
  if (kind === 'csp') {
    return {
      type: 'csp',
      message: ev.violatedDirective || 'CSP violation',
      source: ev.sourceFile || '',
      line: ev.lineNumber == null ? null : ev.lineNumber,
      col: ev.columnNumber == null ? null : ev.columnNumber,
      extra: {
        violatedDirective: ev.violatedDirective || '',
        blockedURI: ev.blockedURI || '',
        disposition: ev.disposition || '',
      },
    };
  }
  return { type: 'unknown', message: 'unknown', source: '', line: null, col: null, extra: {} };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: 新增 11 条测试全 PASS，原有测试不受影响。

- [ ] **Step 5: 跑完整闸门**

Run: `npm run check`
Expected: eslint + prettier format:check + node --test + qa + qa:css 全绿。若 prettier 报格式，`npx prettier --write js/shared/error-report-id.js tests/error-report-id.test.mjs` 后再跑一次。

- [ ] **Step 6: 提交**

```bash
git add js/shared/error-report-id.js tests/error-report-id.test.mjs
git commit -m "feat(observability): 错误指纹/docId/归一化 纯逻辑模块 + 单测"
```

---

## Task 2: 装配层 report-error.js

**Files:**
- Create: `js/shared/report-error.js`

- [ ] **Step 1: 写实现**（此层是 DOM+Firebase 胶水，不写单测，靠 `npm run check` 的 eslint/prettier 把关 + 后续人工验证）

创建 `js/shared/report-error.js`：

```js
// 统一前端错误上报：监听 JS 报错 / 未处理 promise / CSP 违规，去重后写 Firestore errors 集合。
// 判定逻辑在 error-report-id.js（纯函数、有单测）；这里是接 Firebase 的装配层。
// 沿用 track-visit.js 的模式（确定性ID + setDoc merge + expireAt TTL）。
//
// 用法（在已登录页面脚本开头尽早调用一次）：
//   import { db } from '/js/shared/firebase-init.js';
//   import { initErrorReporting } from '/js/shared/report-error.js';
//   initErrorReporting({ db });
//
// 原则：上报绝不抛错、绝不阻断页面——全程 try/catch + .catch() 静默。
import {
  doc,
  setDoc,
  serverTimestamp,
  increment,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { errorFingerprint, errorDocId, normalizeError } from './error-report-id.js';

// 6个月，配合 Firestore TTL 策略（expireAt 字段）自动清理。沿用 visits 的口径。
const RETENTION_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export function initErrorReporting({ db }) {
  const write = (kind, ev) => {
    try {
      const r = normalizeError(kind, ev);
      const id = errorDocId(errorFingerprint(r));
      setDoc(
        doc(db, 'errors', id),
        {
          type: r.type,
          message: r.message,
          source: r.source,
          line: r.line,
          col: r.col,
          ...r.extra,
          count: increment(1),
          lastSeen: serverTimestamp(),
          lastPage: location.pathname,
          lastEmail: localStorage.getItem('sdf_user_email') || '',
          lastUserAgent: navigator.userAgent,
          expireAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
        },
        { merge: true },
      ).catch(() => {});
    } catch {
      /* 上报本身绝不抛错 */
    }
  };
  window.addEventListener('error', (e) => write('js', e));
  window.addEventListener('unhandledrejection', (e) => write('promise', e));
  document.addEventListener('securitypolicyviolation', (e) => write('csp', e));
}
```

- [ ] **Step 2: 跑完整闸门**

Run: `npm run check`
Expected: 全绿。若 prettier 报格式，`npx prettier --write js/shared/report-error.js` 后再跑。

- [ ] **Step 3: 提交**

```bash
git add js/shared/report-error.js
git commit -m "feat(observability): report-error 装配层（挂监听、去重写 Firestore）"
```

---

## Task 3: 挂载到 5 个 demo 工具页

这 5 页都已 `import { auth, db } from '/js/shared/firebase-init.js';`，只需加一行 import + 一行调用。

**Files:**
- Modify: `solutions/demo/translation.html`
- Modify: `solutions/demo/analysis.html`
- Modify: `solutions/demo/proofreader.html`
- Modify: `solutions/demo/lifestory.html`
- Modify: `solutions/demo/japanese_learner.html`

- [ ] **Step 1: 每页加 import**

在每页那句 `import { ... } from '/js/shared/firebase-init.js';` 的**下一行**插入：

```js
import { initErrorReporting } from '/js/shared/report-error.js';
```

- [ ] **Step 2: 每页加初始化调用**

在该模块脚本里、所有 import 之后、其它逻辑（如 `mountAuthGate(...)`、`showTool` 定义、`_track` 等）**之前**，插入一行：

```js
initErrorReporting({ db });
```

> 放在最前是为了尽早挂上监听，能捕获后续脚本的报错。`db` 已从 firebase-init 导入，无需改动。

- [ ] **Step 3: 跑闸门**

Run: `npm run check`
Expected: 全绿（未改 Tailwind class，qa:css 不受影响）。prettier 报格式则 `npx prettier --write <改动的文件>` 后再跑。

- [ ] **Step 4: 提交**

```bash
git add solutions/demo/translation.html solutions/demo/analysis.html solutions/demo/proofreader.html solutions/demo/lifestory.html solutions/demo/japanese_learner.html
git commit -m "feat(observability): 5 个 demo 工具页挂载 initErrorReporting"
```

---

## Task 4: 挂载到管理页 + bids

**Files:**
- Modify: `admin/index.html`（当前只 import 了 `{ auth }`，需补 `db`）
- Modify: `admin/blog/index.html`（已 import `{ auth, db }`）
- Modify: `solutions/demo/admin.html`（已在用 `db`）
- Modify: `bids/index.html`（已 import `{ auth, db }`）

- [ ] **Step 1: admin/index.html 补 db 导入**

把：
```js
import { auth } from '/js/shared/firebase-init.js';
```
改为：
```js
import { auth, db } from '/js/shared/firebase-init.js';
```

- [ ] **Step 2: 四页各加 import 与调用**

每页在其 firebase-init 那行 import 下一行加：
```js
import { initErrorReporting } from '/js/shared/report-error.js';
```
并在该脚本 import 之后、`onAuthStateChanged(...)` 等逻辑之前加一行：
```js
initErrorReporting({ db });
```

> `solutions/demo/admin.html` 若 `db` 不是从 firebase-init 显式 import（而是全局可用），确认 `db` 在该作用域可用即可；不可用则同样补 `import { db } from '/js/shared/firebase-init.js';`。

- [ ] **Step 3: 跑闸门**

Run: `npm run check`
Expected: 全绿。prettier 报格式则 `npx prettier --write <改动的文件>` 后再跑。

- [ ] **Step 4: 提交**

```bash
git add admin/index.html admin/blog/index.html solutions/demo/admin.html bids/index.html
git commit -m "feat(observability): 管理页与 bids 挂载 initErrorReporting"
```

---

## Task 5: admin.html「错误日志」面板

**Files:**
- Modify: `solutions/demo/admin.html`

- [ ] **Step 1: 加面板 markup**

在 `<!-- Stat Cards -->` 这个注释**之前**（即"招标抓取监控"卡片之后）插入一张卡片（复用现有 `.card` / `.tbl-scroll` class，不引入新 Tailwind class）：

```html
  <!-- Error Log -->
  <div class="card mb-6">
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm font-medium text-gray-700">错误日志</div>
      <div class="flex items-center gap-2">
        <span id="errCount" class="text-xs text-gray-400"></span>
        <button onclick="loadErrors()" type="button" class="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">↻ 刷新</button>
      </div>
    </div>
    <div class="tbl-scroll">
      <table class="w-full text-xs">
        <thead class="text-gray-400 border-b border-gray-100">
          <tr>
            <th class="text-left py-2 pr-4 font-normal">最近</th>
            <th class="text-left py-2 pr-4 font-normal">次数</th>
            <th class="text-left py-2 pr-4 font-normal">类型</th>
            <th class="text-left py-2 pr-4 font-normal">消息</th>
            <th class="text-left py-2 pr-4 font-normal">页面</th>
            <th class="text-left py-2 font-normal">用户</th>
          </tr>
        </thead>
        <tbody id="errTable">
          <tr><td colspan="6" class="py-4 text-center text-gray-400">加载中…</td></tr>
        </tbody>
      </table>
    </div>
  </div>
```

- [ ] **Step 2: 加 loadErrors / renderErrors / escapeHtml**

在 `<script type="module">` 里（与 `loadData`/`renderDashboard` 同一层，例如紧跟 `renderDashboard` 之后）加入：

```js
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

window.loadErrors = async function () {
  const body = document.getElementById('errTable');
  try {
    const q = query(collection(db, 'errors'), orderBy('lastSeen', 'desc'), limit(200));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderErrors(docs);
  } catch (e) {
    console.error(e);
    body.innerHTML =
      '<tr><td colspan="6" class="py-4 text-center text-red-400">加载失败，请检查 Firestore 规则</td></tr>';
  }
};

function renderErrors(docs) {
  document.getElementById('errCount').textContent = `共 ${docs.length} 类`;
  document.getElementById('errTable').innerHTML =
    docs
      .map((d) => {
        const ts = d.lastSeen?.toDate();
        const timeStr = ts
          ? ts.toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—';
        const msg =
          d.type === 'csp'
            ? `${escapeHtml(d.message)} → ${escapeHtml(d.blockedURI || '')}`
            : escapeHtml(d.message);
        return `<tr class="hover:bg-gray-50 align-top">
      <td class="py-2 pr-4 text-gray-400 whitespace-nowrap">${timeStr}</td>
      <td class="py-2 pr-4 text-gray-600">${d.count || 1}</td>
      <td class="py-2 pr-4 text-gray-500 whitespace-nowrap">${escapeHtml(d.type || '')}</td>
      <td class="py-2 pr-4 text-gray-700 max-w-[280px] break-words">${msg}</td>
      <td class="py-2 pr-4 text-gray-400 whitespace-nowrap">${escapeHtml(d.lastPage || '')}</td>
      <td class="py-2 text-gray-400 max-w-[160px] truncate" title="${escapeHtml(d.lastEmail || '')}">${escapeHtml(d.lastEmail || '')}</td>
    </tr>`;
      })
      .join('') ||
    '<tr><td colspan="6" class="py-4 text-center text-gray-400">暂无错误记录</td></tr>';
}
```

- [ ] **Step 3: 在登录通过后调用 loadErrors**

在 `onAuthStateChanged` 的管理员通过分支里（现有 `loadUsers(); loadScrapeStatus(); await loadData();` 处）加一行 `loadErrors();`：

```js
    loadUsers();
    loadScrapeStatus();
    loadErrors();
    await loadData();
```

- [ ] **Step 4: 跑闸门**

Run: `npm run check`
Expected: 全绿。若 `qa:css` 报 Tailwind 不同步（理论上不会，因全用现有 class），执行 `npm run build:css` 后把 `css/tailwind.min.css` 一并加入提交；prettier 报格式则 `npx prettier --write solutions/demo/admin.html` 后再跑。

- [ ] **Step 5: 提交**

```bash
git add solutions/demo/admin.html
git commit -m "feat(observability): admin 后台加错误日志面板（消息转义防注入）"
```

---

## Task 6: 文档

**Files:**
- Modify: `docs/TOOLS.md`

- [ ] **Step 1: 记录到 TOOLS.md**

在 `docs/TOOLS.md` 适当位置补一段（放在 visits/admin 相关记录附近）：

```markdown
### 观测（3E，2026-07-27）

- 前端错误收集：`js/shared/report-error.js` 的 `initErrorReporting({db})` 监听 `error`/`unhandledrejection`/`securitypolicyviolation`，去重后写 Firestore `errors` 集合（指纹+日期做 docId，`count` 累加，`expireAt` 6 个月 TTL）。判定逻辑在 `js/shared/error-report-id.js`（纯函数、有单测）。已挂载：5 个 demo 工具页 + admin/index + admin/blog + solutions/demo/admin + bids。
- CSP 违规也走这条链路收集（`securitypolicyviolation` 事件，`disposition` 区分 report/enforce），Report-Only CSP 的违规可在后台「错误日志」面板看，不用逐页开 F12。
- 查看：`solutions/demo/admin.html`「错误日志」面板。
- **需在 Firebase 控制台加规则**（未加则前端写入被拒、面板为空）：
  `match /errors/{doc} { allow create, update: if isSignedIn(); allow read: if isAdmin(); }`
- TTL 策略（集合 `errors`、字段 `expireAt`）同 visits 一样暂受 GCP 权限限制搁置。
```

- [ ] **Step 2: 跑闸门**

Run: `npm run check`
Expected: 全绿（改的是 md，不影响测试/扫描）。

- [ ] **Step 3: 提交**

```bash
git add docs/TOOLS.md
git commit -m "docs(observability): 记录 3E 错误收集机制与所需 Firestore 规则"
```

---

## 收尾（人工，挂账镜像恢复）

- 在 Firebase 控制台加上 Task 6 里的 `errors` 集合规则。
- 镜像恢复上线后人工验证：某工具页控制台 `throw new Error('test-3e')`、制造一次 CSP 违规，确认后台「错误日志」面板出现记录、重复触发 `count` 累加而不新增文档、消息里的 `<` 等字符被正确转义显示。

---

## Self-Review（写完自查）

**1. Spec 覆盖**
- 4.1 纯模块 → Task 1 ✅（含 normalizeError 资源错误分支、promise 字符串 reason、CSP 字段）
- 4.2 装配层 report-error.js → Task 2 ✅（三监听、去重 increment、expireAt、best-effort、无 firstSeen）
- 4.3 挂载 10 页 → Task 3（5 demo）+ Task 4（admin×3 + bids）✅
- 4.4 admin 面板 → Task 5 ✅（含转义，spec 未明说但属正确性必需，已在 Task 5 补上）
- 第 5 节数据模型 → Task 2 写入字段一致（type/message/source/line/col/count/lastSeen/lastPage/lastEmail/lastUserAgent/expireAt + CSP 的 violatedDirective/blockedURI/disposition）✅
- 第 6 节 Firestore 规则 → Task 6 文档记录 + 收尾人工步骤 ✅
- 第 7 节测试 → Task 1 覆盖纯函数；胶水层留人工验证 ✅

**2. 无占位符**：各步均含完整代码与命令，无 TBD/TODO。

**3. 命名一致性**：`errorFingerprint` / `errorDocId` / `normalizeError` / `initErrorReporting` / `loadErrors` / `renderErrors` / `escapeHtml` 在计划内前后一致；集合名 `errors`、字段名与 spec 第 5 节一致。
