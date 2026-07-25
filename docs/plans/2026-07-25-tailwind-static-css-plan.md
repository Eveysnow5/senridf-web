# 3B 流畅：Tailwind CDN → 静态 CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 4 个页面（bids / admin监控 / japanese_learner / proofreader）的 Tailwind Play CDN 运行时编译器换成提交进仓库的静态 CSS（内容扫描生成，约 20KB），并加一个"重新生成后对比"的自动检查接进 `npm run check`，让"改了 class 却忘了重新生成"变成会响的错。

**Architecture:** Tailwind CLI（开发期工具，devDep）用 `content` 扫描这 4 个 HTML 生成静态 `css/tailwind.min.css`，提交进仓库；4 个页面把 `<script src=cdn.tailwindcss.com>` 换成 `<link href=/css/tailwind.min.css>`；一个 Node 检查脚本重新生成一份临时 CSS 跟已提交的逐字节对比（换行归一 LF），不一致就报错。部署仍零构建（Cloudflare 只服务静态文件，生成命令只在开发期跑）。

**Tech Stack:** Tailwind CSS 3.4.16 CLI、Node（`scripts/qa/`）、纯静态站。

---

## 背景（写代码前必读）

- 设计文档：`docs/specs/2026-07-25-tailwind-static-css-design.md`（每个任务对应其中章节）。
- 项目部署链路：本地 `git commit` → 手动 `git push`（先总结再推）→ 镜像 → Cloudflare。**当前镜像故障**（`MIRROR_PAT` 待同事处理，约3周后），push 到自己仓库没问题，但不会自动上线——人工验证（Task 5）要等镜像恢复。
- **以下命令/事实都已在本地临时目录实测跑通**，计划直接用：
  - `tailwindcss@3.4.16` 安装正常。
  - `tailwind.config.js` 用 `content` 指向这 4 个 HTML、默认主题、**无 safelist**，跑 `tailwindcss -c tailwind.config.js -i css/tailwind.src.css -o css/tailwind.min.css --minify` → 约 1.4 秒、产物约 20194 字节。
  - 产物正确包含全部 6 个方括号任意值类和动态 bg 颜色。
  - ⚠️ **`safelist: [{pattern: /.*/}]` 全量生成会卡死（2分钟不出），绝对不要用**；就用纯 content 扫描。
  - 从 Node 里调 Tailwind CLI 用 `node <ROOT>/node_modules/tailwindcss/lib/cli.js ...`（bin 入口是 `tailwindcss/lib/cli.js`，用 `process.execPath` 跑，跨平台、绕开 Windows `.cmd` 坑）。
  - **grep 假阴性坑**：CSS 里方括号是转义的（`.max-w-\[120px\]{max-width:120px}`），验证产物时按**值**（`120px`、`max-width:120px`）grep，别按带方括号的 class 名 grep。
- **已确认无需处理的点**：`.prettierignore` 里已有 `**/*.css`，所以 `css/tailwind.min.css` 和 `css/tailwind.src.css` 本来就不被 prettier 检查——不用再往 `.prettierignore` 加东西。
- 现有 `package.json` scripts：`lint`=`eslint .`、`format:check`=`prettier --check .`、`test`=`node --test`、`qa`=`node scripts/qa/scan.js`、`check`=`lint && format:check && test && qa`。
- 现有检查脚本风格参照 `scripts/qa/scan.js`（`node:fs`/`node:path`，从 `__dirname` 解析 ROOT，出问题非零退出）。

---

### Task 1: 生成工具 + 产出静态 CSS

对应设计文档 §4。

**Files:**
- Create: `css/tailwind.src.css`
- Create: `tailwind.config.js`
- Create: `css/tailwind.min.css`（由命令生成）
- Modify: `package.json`

- [ ] **Step 1: 创建输入源文件 `css/tailwind.src.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: 创建 `tailwind.config.js`（仓库根）**

```js
/** @type {import('tailwindcss').Config} */
// 只扫描这 4 个用 Tailwind 的页面，生成它们实际用到的 class（含 JS 字符串里的、
// 方括号任意值的）。默认主题、无 safelist——safelist 全量生成会把 CLI 卡死。
module.exports = {
  content: [
    './bids/index.html',
    './solutions/demo/admin.html',
    './solutions/demo/japanese_learner.html',
    './solutions/demo/proofreader.html',
  ],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 3: 修改 `package.json`——加 devDep 和 build:css 脚本**

把：
```json
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "node --test",
    "qa": "node scripts/qa/scan.js",
    "check": "npm run lint && npm run format:check && npm run test && npm run qa"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "cheerio": "^1.0.0",
    "eslint": "^9.13.0",
    "globals": "^15.11.0",
    "prettier": "^3.3.3"
  }
```
改成（新增 `build:css` 脚本；devDependencies 加 `tailwindcss` 锁 3.4.16；`check` 暂不动，Task 2 再接 css 检查）：
```json
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "node --test",
    "qa": "node scripts/qa/scan.js",
    "build:css": "tailwindcss -c tailwind.config.js -i css/tailwind.src.css -o css/tailwind.min.css --minify",
    "check": "npm run lint && npm run format:check && npm run test && npm run qa"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "cheerio": "^1.0.0",
    "eslint": "^9.13.0",
    "globals": "^15.11.0",
    "prettier": "^3.3.3",
    "tailwindcss": "3.4.16"
  }
```

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: 安装完成，`node_modules/tailwindcss` 存在，`package-lock.json` 更新。

- [ ] **Step 5: 生成静态 CSS**

Run: `npm run build:css`
Expected: 约 1-2 秒完成，生成 `css/tailwind.min.css`（约 20KB）。

- [ ] **Step 6: 验证产物包含关键 class（按值 grep，避开方括号转义假阴性）**

Run（Git Bash）：
```bash
wc -c css/tailwind.min.css
for v in 120px 160px 180px 260px 540px 'font-size:10px' bg-blue-50 bg-green-50 bg-purple-50; do
  printf "%-16s " "$v:"; grep -c "$v" css/tailwind.min.css
done
```
Expected: 文件约 20000 字节；9 个值每个 grep 计数都 ≥ 1（6 个任意值 + 3 个动态 bg 颜色都在）。若任一为 0，停止排查（多半是 content 路径没对上）。

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js css/tailwind.src.css css/tailwind.min.css package.json package-lock.json
git commit -m "feat(css): generate static Tailwind CSS for the 4 CDN pages (content-scan)"
```
commit message 结尾加：
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: "重新生成后对比"自动检查 + 接进 npm run check

对应设计文档 §5（第一层验证）。

**Files:**
- Create: `scripts/qa/check-css.js`
- Modify: `package.json`

- [ ] **Step 1: 创建 `scripts/qa/check-css.js`**

```js
// 校验 css/tailwind.min.css 是否与当前 4 个页面的 class 同步。
// 做法：用与 build:css 完全相同的配置把 CSS 重新生成到临时文件，跟已提交的
// css/tailwind.min.css 逐字节比对（比对前把换行统一成 LF，规避 Windows CRLF
// 与 Linux CI LF 的假差异）。不一致 = 有人改了页面 class 却没重新生成 → 非零退出。
// 用法：node scripts/qa/check-css.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COMMITTED = path.join(ROOT, 'css', 'tailwind.min.css');
const TMP = path.join(os.tmpdir(), `tailwind-check-${process.pid}.css`);
// 从 Node 里跨平台调 Tailwind CLI：用 node 直接跑 CLI 的 js 入口，绕开 Windows 的 .bin/.cmd 问题
const CLI = require.resolve('tailwindcss/lib/cli.js', { paths: [ROOT] });

const normalize = (s) => s.replace(/\r\n/g, '\n');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(COMMITTED)) {
  fail('缺少 css/tailwind.min.css，请先运行 npm run build:css 生成并提交。');
}

try {
  execFileSync(
    process.execPath,
    [CLI, '-c', 'tailwind.config.js', '-i', 'css/tailwind.src.css', '-o', TMP, '--minify'],
    { cwd: ROOT, stdio: 'pipe' },
  );
} catch (e) {
  fail('重新生成 Tailwind CSS 失败：' + (e.stderr ? e.stderr.toString() : e.message));
}

const fresh = normalize(fs.readFileSync(TMP, 'utf8'));
const committed = normalize(fs.readFileSync(COMMITTED, 'utf8'));
fs.rmSync(TMP, { force: true });

if (fresh !== committed) {
  fail(
    '检测到 4 个页面用到的 Tailwind class 有变化，但 css/tailwind.min.css 没有同步更新。\n' +
      '请运行 npm run build:css，再把更新后的 css/tailwind.min.css 一起提交。',
  );
}

console.log('Tailwind CSS 校验通过：css/tailwind.min.css 与页面 class 同步。');
```

- [ ] **Step 2: 修改 `package.json`——加 qa:css 脚本并接进 check**

把：
```json
    "qa": "node scripts/qa/scan.js",
    "build:css": "tailwindcss -c tailwind.config.js -i css/tailwind.src.css -o css/tailwind.min.css --minify",
    "check": "npm run lint && npm run format:check && npm run test && npm run qa"
```
改成：
```json
    "qa": "node scripts/qa/scan.js",
    "qa:css": "node scripts/qa/check-css.js",
    "build:css": "tailwindcss -c tailwind.config.js -i css/tailwind.src.css -o css/tailwind.min.css --minify",
    "check": "npm run lint && npm run format:check && npm run test && npm run qa && npm run qa:css"
```

- [ ] **Step 3: 跑 lint 确认新脚本没问题**

Run: `npx eslint scripts/qa/check-css.js`
Expected: 无报错输出（`scripts/**/*.js` 已被 eslint 配置覆盖为 CommonJS + node 全局）。

- [ ] **Step 4: 跑完整 check，确认通过（css 检查绿）**

Run: `npm run check`
Expected: 全部通过，末尾出现"Tailwind CSS 校验通过：css/tailwind.min.css 与页面 class 同步。"

- [ ] **Step 5: 证明这个检查真的能抓到"改了 class 没重新生成"（关键——让它先红再绿）**

往一个被扫描的页面**追加**一个"合法但当前没用过"的 Tailwind 类。用 `grayscale`（合法核心工具类 `.grayscale{filter:grayscale(100%)}`，这几个数据/表单页确定没用过；必须选合法类，否则 Tailwind 会忽略未知类、重新生成结果不变、测试就失效——`mt-99` 这种超出默认范围的就是无效的，别用）。追加到文件末尾即可，Tailwind 扫描器只认 class 字符串、不管 HTML 结构：

Run（Git Bash）：`echo '<div class="grayscale"></div>' >> solutions/demo/proofreader.html`
然后：
Run: `node scripts/qa/check-css.js`
Expected: **非零退出**，打印"检测到 4 个页面用到的 Tailwind class 有变化…请运行 npm run build:css…"（因为重新生成的 CSS 多了 `.grayscale` 规则，与已提交的不一致）。

撤销刚才的改动：
Run（Git Bash）：`git checkout -- solutions/demo/proofreader.html`
再跑一次确认恢复绿：
Run: `node scripts/qa/check-css.js`
Expected: 退出码 0，打印"Tailwind CSS 校验通过…"。

（这一步只为验证守卫有效，不产生任何提交——`git checkout --` 已还原页面。）

- [ ] **Step 6: Commit**

```bash
git add scripts/qa/check-css.js package.json
git commit -m "feat(qa): guard tailwind.min.css freshness via regenerate-and-diff check"
```
commit message 结尾加：
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 3: 4 个页面把 CDN 换成静态 CSS

对应设计文档 §4（4 个页面改动）。4 页第 7 行都是同一行 `<script src="https://cdn.tailwindcss.com/3.4.16"></script>`。**只换这一行，各页自带的 `<style>` 块和其它所有内容一律不动。** 换 `<link>` 不改动任何 class，所以已提交的 `css/tailwind.min.css` 仍然有效，Task 2 的检查保持绿。

**Files:**
- Modify: `bids/index.html:7`
- Modify: `solutions/demo/admin.html:7`
- Modify: `solutions/demo/japanese_learner.html:7`
- Modify: `solutions/demo/proofreader.html:7`

- [ ] **Step 1: `bids/index.html`**

把：
```html
  <script src="https://cdn.tailwindcss.com/3.4.16"></script>
```
改成：
```html
  <link rel="stylesheet" href="/css/tailwind.min.css" />
```

- [ ] **Step 2: `solutions/demo/admin.html`**

把：
```html
  <script src="https://cdn.tailwindcss.com/3.4.16"></script>
```
改成：
```html
  <link rel="stylesheet" href="/css/tailwind.min.css" />
```

- [ ] **Step 3: `solutions/demo/japanese_learner.html`**

把：
```html
  <script src="https://cdn.tailwindcss.com/3.4.16"></script>
```
改成：
```html
  <link rel="stylesheet" href="/css/tailwind.min.css" />
```

- [ ] **Step 4: `solutions/demo/proofreader.html`**

把：
```html
  <script src="https://cdn.tailwindcss.com/3.4.16"></script>
```
改成：
```html
  <link rel="stylesheet" href="/css/tailwind.min.css" />
```

- [ ] **Step 5: 确认 4 页都不再引用 CDN、都引用了静态 CSS**

Run（Git Bash）：
```bash
grep -rl "cdn.tailwindcss.com" bids/index.html solutions/demo/admin.html solutions/demo/japanese_learner.html solutions/demo/proofreader.html
echo "--- 上面应无输出（无残留 CDN 引用）---"
grep -c "/css/tailwind.min.css" bids/index.html solutions/demo/admin.html solutions/demo/japanese_learner.html solutions/demo/proofreader.html
```
Expected: 第一条无输出；第二条 4 个文件各计数 1。

- [ ] **Step 6: 跑完整 check（含死链扫描 + css 同步检查）**

Run: `npm run check`
Expected: 全部通过。特别是 `qa`（`scan.js` 死链扫描）对新增的本地链接 `/css/tailwind.min.css` 不报错（文件已存在），`qa:css` 仍绿（换 link 不改 class）。

- [ ] **Step 7: Commit**

```bash
git add bids/index.html solutions/demo/admin.html solutions/demo/japanese_learner.html solutions/demo/proofreader.html
git commit -m "perf(pages): swap Tailwind Play CDN for static css on the 4 pages"
```
commit message 结尾加：
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 4: 更新 `docs/TOOLS.md`

**Files:**
- Modify: `docs/TOOLS.md`

- [ ] **Step 1**：先 Read `docs/TOOLS.md`，找到"修改记录"章节最近条目（2026-07-24/07-25）的格式（`- **日期：标题**` + 缩进子弹点），以及描述开发工具链/`npm run check` 的段落。

- [ ] **Step 2**：在描述开发工具链的段落补充：新增 `npm run build:css`（用 Tailwind CLI 内容扫描 4 个页面生成 `css/tailwind.min.css`）、`npm run check` 新增 `qa:css`（重新生成后对比，防"改了 class 没重新生成"）。

- [ ] **Step 3**：在"修改记录"章节末尾追加一条（日期 2026-07-25，沿用你 Step 1 确认的真实格式）：
```
3B 流畅：4 个页面（bids/admin监控/japanese_learner/proofreader）的 Tailwind Play CDN 运行时编译器 → 提交进仓库的静态 css/tailwind.min.css（Tailwind CLI 内容扫描生成，约20KB）
新增 npm run build:css（生成）；npm run check 增 qa:css（scripts/qa/check-css.js，重新生成后对比，改了 class 没重新生成会报错提醒）
维护：改这些页面已有样式类无需动作；只有新增当前没用过的类时 check 报错提醒跑 build:css。tailwindcss 是 devDep（3.4.16），部署仍零构建
```

- [ ] **Step 4: Commit**

```bash
git add docs/TOOLS.md
git commit -m "docs: record 3B Tailwind static CSS migration in TOOLS.md"
```
commit message 结尾加：
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 5: 人工验证（第三层，镜像恢复后，不分派子代理）

对应设计文档 §5 第三层。这一步不是代码改动，等镜像恢复、`git push` 后由用户手动做，与 3C/3D/图片上传的人工验证排在同一队列：

- [ ] 1. `git push`（需用户确认），等镜像恢复、Cloudflare 构建上线。
- [ ] 2. 镜像恢复后，登录后打开这 4 个页面，确认视觉与改动前一致、无样式错乱：
   - `https://www.senridf.com/bids/`（招标列表：表格、筛选、"已结束"灰标签）
   - `https://www.senridf.com/solutions/demo/admin.html`（监控后台：统计卡片、图表、用户表）
   - `https://www.senridf.com/solutions/demo/japanese_learner.html`（动词活用表：三色行 bg-blue/green/purple-50）
   - `https://www.senridf.com/solutions/demo/proofreader.html`（校对：布局、按钮、最小宽表格）
- [ ] 3. 顺带确认首屏不再有 Tailwind 运行时编译的样式闪烁（FOUC）。

---

## Spec 覆盖率自查

| 设计文档章节 | 对应任务 |
|---|---|
| §2 内容扫描小文件 + 检查兜底 | Task 1（生成）、Task 2（检查） |
| §3 6 个方括号任意值类由扫描捕获 | Task 1 Step 6（按值 grep 验证都在） |
| §4 生成工具与文件、4 页改动、零构建、维护流程 | Task 1（工具+CSS）、Task 3（4 页换 link）、Task 4（维护流程记文档） |
| §5 第一层"重新生成后对比"检查 | Task 2（含 Step 5 证明能抓到变化） |
| §5 第二层（跳过） | 计划中无对应任务，符合用户决定 |
| §5 第三层人工终检 | Task 5 |
| §6 范围外（不动 main.css / 不改 HTML 结构·class·功能 / 不做 SDK 按需·字体·图片 / 不引入打包器） | 计划只换样式加载方式 + 加检查，无越界任务，符合预期 |
| §7 成功标准 | Task 3 Step 5-6（不再引 CDN、check 绿）、Task 5（人工视觉一致） |

**CI 测不了、须等镜像恢复人工验证的**：Task 5 全部（4 页真实视觉、FOUC 消除）——因为这几个页面在登录门控后、且镜像故障期间不会上线。CI 能覆盖的：CSS 生成正确性（Task 1 Step 6）、CSS 与 class 同步（Task 2 的 qa:css，进 CI）、无残留 CDN 引用 + 无死链（Task 3 Step 5-6）。

placeholder/类型一致性自查：`css/tailwind.src.css`、`css/tailwind.min.css`、`tailwind.config.js`、`scripts/qa/check-css.js`、`build:css`、`qa:css` 这些命名在所有任务里保持一致；`build:css` 与 check-css.js 里的重新生成用**完全相同**的参数（`-c tailwind.config.js -i css/tailwind.src.css --minify`），保证对比基准一致。
