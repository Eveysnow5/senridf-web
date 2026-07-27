# 3E 观测：前端错误 + CSP 违规收集 设计

日期：2026-07-27
状态：已与用户确认方向，待写实施计划

## 1. 背景

`docs/specs/2026-07-01-site-optimization.md` 第三期里的「观测」一项：让线上问题能被团队发现。当前全站**没有任何全局错误捕获**（`window.onerror`/`unhandledrejection` 一个都没有），线上一旦有 JS 报错、未处理的 promise rejection，或用户遇到功能失灵，团队无从知晓——只能等用户反馈或自己碰巧撞见（历史上"注册空白页"就是这么被动发现的）。

此外，`_headers` 里刚上的 `Content-Security-Policy-Report-Only` 违规目前只打印到浏览器 DevTools 控制台，没有集中收集——要验证 CSP 是否漏配来源，得逐页手动开 F12 看，很不方便。

3E 用一个统一的轻量机制把这两类信号都收集起来。

## 2. 范围

**做（最小可用）**：
- 捕获**已登录页面**（工具页/管理页/bids）上的：JS 报错（`error` 事件）、未处理的 promise rejection（`unhandledrejection` 事件）、CSP 违规（`securitypolicyviolation` 事件）。
- 写入 Firestore `errors` 集合，按错误指纹去重（同一错误一天一条 + 出现次数），记录最近一次的页面/浏览器/用户邮箱。
- 管理后台（`solutions/demo/admin.html`）加「错误」面板展示。

**明确不做（YAGNI）**：
- 公开页（首页/关于/account.html 等未登录场景）的报错收集——需允许未登录写 Firestore，有刷垃圾风险，成本收益不划算。
- API 端（`functions/api/`）服务端失败的独立记录——本期只靠前端上报。
- 告警/通知、采样、外部 APM 服务（Sentry 等）。

## 3. 架构

沿用 3C `visits` 的既有模式：**前端直接用 Firebase SDK 写 Firestore，不新增任何后端端点或 Cloudflare Function**。三类信号都通过浏览器原生事件在客户端捕获——尤其 CSP 违规用 `securitypolicyviolation` DOM 事件捕获，因此**不需要**给 CSP 配 `report-uri`/`report-to` HTTP 端点，也就避免了"公开无鉴权端点写 Firestore"的凭据与滥用难题。

```
用户页面（已登录）
  ├─ window 'error'                 ┐
  ├─ window 'unhandledrejection'    ├─→ report-error.js 归一化 → setDoc(merge) → Firestore errors 集合
  └─ document 'securitypolicyviolation' ┘                                            │
                                                                                     ▼
                                                              solutions/demo/admin.html「错误」面板读取展示
```

零构建约束下均为静态 `<script type="module">` + ESM，无新增依赖。

## 4. 组件

### 4.1 `js/shared/error-report-id.js`（纯逻辑，有单测）

参照 `js/shared/track-visit-id.js` 的分层习惯，把不碰 DOM/Firebase 的判定逻辑拆成纯函数：

```js
// 稳定短指纹：同一个错误（相同类型/消息/来源/行）产出相同指纹
export function errorFingerprint({ type, message, source, line }) { /* 归一化 + 短 hash */ }

// 文档 ID：指纹 + 当天日期（同一错误一天去重到一条）
export function errorDocId(fingerprint, now = new Date()) {
  return `${fingerprint}_${now.toISOString().slice(0, 10)}`;
}

// 把浏览器事件归一化成待写入的报告对象（纯函数，输入普通对象、输出普通对象）
export function normalizeError(kind, ev) { /* → { type, message, source, line, col, extra } */ }
```

- `errorFingerprint`：对 message 做轻度归一化（去掉行内数字/URL query 等易变部分，避免同一错误因动态数字被算成多条），再取短 hash（如 base36 的简单字符串 hash，无需加密强度）。
- `normalizeError`：对三类事件（`js`/`promise`/`csp`）分别抽取字段——JS 取 `message`/`filename`/`lineno`/`colno`；promise 取 `reason`；CSP 取 `violatedDirective`/`blockedURI`/`disposition`/`sourceFile`/`lineNumber`。统一映射到 `{ type, message, source, line, col, extra }`。

### 4.2 `js/shared/report-error.js`（装配层，不单测）

```js
import { doc, setDoc, serverTimestamp, increment, Timestamp }
  from '.../firebase-firestore.js';
import { errorFingerprint, errorDocId, normalizeError } from './error-report-id.js';

const RETENTION_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 沿用 visits 的 6 个月

export function initErrorReporting({ db }) {
  const write = (kind, ev) => {
    try {
      const r = normalizeError(kind, ev);
      const fp = errorFingerprint(r);
      const id = errorDocId(fp);
      setDoc(doc(db, 'errors', id), {
        type: r.type, message: r.message, source: r.source, line: r.line, col: r.col,
        ...r.extra,
        count: increment(1),
        lastSeen: serverTimestamp(),
        lastPage: location.pathname,
        lastEmail: localStorage.getItem('sdf_user_email') || '',
        lastUserAgent: navigator.userAgent,
        expireAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
      }, { merge: true }).catch(() => {});
    } catch { /* 上报绝不抛错 */ }
  };
  window.addEventListener('error', (e) => write('js', e));
  window.addEventListener('unhandledrejection', (e) => write('promise', e));
  document.addEventListener('securitypolicyviolation', (e) => write('csp', e));
}
```

- **firstSeen 语义**：`serverTimestamp()` + `merge` 每次都会覆盖，无法只在首次写。取舍：`firstSeen` 用客户端在 docId 里已隐含"当天"，精确的首次时间价值不大——本期只保留 `lastSeen`（每次更新）作为排序键，**去掉 `firstSeen` 字段**避免误导。（若日后需要精确首见，另用 `setDoc` 前先 `getDoc` 判断，本期 YAGNI 不做。）
- **best-effort**：整段 try/catch + `.catch(()=>{})`，上报失败（如未登录被规则拒、网络问题）静默吞掉，绝不连累页面。
- **噪音过滤**：`window 'error'` 也会因图片/脚本资源加载失败触发（`event.message` 为空、`event.target` 是元素）——`normalizeError('js', ev)` 里若判定是资源加载错误则打上 `type:'resource'`（或跳过），避免和真正的脚本错误混淆。

### 4.3 挂载

在每个已登录页面的模块脚本开头（`firebase-init` 之后尽早）调用一次：

```js
import { db } from '/js/shared/firebase-init.js';
import { initErrorReporting } from '/js/shared/report-error.js';
initErrorReporting({ db });
```

覆盖页面：`solutions/demo/{translation,analysis,proofreader,lifestory,japanese_learner}.html`、`admin/index.html`、`admin/blog/index.html`、`solutions/demo/admin.html`、`bids/index.html`。

### 4.4 管理后台「错误」面板

在 `solutions/demo/admin.html` 加一个板块（与现有 users/visits/scrape 板块并列），读 `errors` 集合（`orderBy('lastSeen','desc')`、`limit(200)`），表格列：最近时间 / 次数 / 类型 / 消息 / 页面 / 用户 / 浏览器。CSP 类额外显示 violatedDirective + blockedURI。空态显示"暂无错误记录"。

## 5. 数据模型

`errors/{指纹}_{YYYY-MM-DD}`：

| 字段 | 说明 |
|---|---|
| type | `js` / `promise` / `csp` / `resource` |
| message | 错误消息（CSP 为 violatedDirective 概述） |
| source, line, col | 来源文件/行/列（CSP 为 sourceFile） |
| count | 出现次数，`increment(1)` 累加 |
| lastSeen | `serverTimestamp()`，排序键 |
| lastPage, lastEmail, lastUserAgent | 最近一次的上下文 |
| expireAt | TTL 字段，`now + 6 个月` |
| violatedDirective, blockedURI, disposition | 仅 CSP 类 |

## 6. Firestore 安全规则（用户在控制台加）

与 `visits` 同款：
```
match /errors/{doc} {
  allow create, update: if isSignedIn();
  allow read: if isAdmin();
}
```
TTL 策略（集合 `errors`、字段 `expireAt`）同 `visits` 的 TTL 一样，暂受 GCP 权限限制搁置；在此之前错误文档因去重量小、可接受缓慢累积。

## 7. 测试

- **纯函数**（`node --test`）：
  - `errorFingerprint`：同一错误产同指纹；消息里的动态数字/URL query 被归一化后仍同指纹；不同错误不同指纹。
  - `errorDocId`：格式 `指纹_YYYY-MM-DD`；跨天不同 ID。
  - `normalizeError`：js/promise/csp 三类各自抽取正确字段；资源加载错误被标记/跳过。
- **不单测**：DOM 监听 + Firestore 写（IO/DOM 胶水），留人工验证。
- **人工验证**（镜像恢复上线后）：在某工具页控制台故意 `throw new Error('test-3e')` 与制造一次 CSP 违规，确认管理后台「错误」面板出现对应记录、同一错误重复触发 count 累加而不新增文档。

## 8. 错误处理

上报模块自身**绝不抛错、绝不阻断页面**：所有写入 try/catch + `.catch()` 静默。未登录或规则拒绝导致的写入失败视为正常（本期只收已登录页，登录后才有权限）。
