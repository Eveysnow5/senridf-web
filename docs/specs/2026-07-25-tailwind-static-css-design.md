# 3B 流畅：Tailwind CDN 运行时编译器 → 静态 CSS 设计

日期：2026-07-25
状态：已与用户确认方向，待实施

## 1. 背景

`docs/specs/2026-07-01-site-optimization.md` 第三期"流畅"子项：4 个页面用 Tailwind Play CDN（`https://cdn.tailwindcss.com/3.4.16`）——浏览器加载后**在运行时现场编译 CSS**，官方明确说别用于生产，拖慢首屏、有样式闪烁（FOUC）。用户在这次会话里选定优先做这一项。

实地排查确认：

- 确切 4 个页面：`bids/index.html`、`solutions/demo/admin.html`、`solutions/demo/japanese_learner.html`、`solutions/demo/proofreader.html`。
- 四页 head 里都是同一行（第 7 行）：`<script src="https://cdn.tailwindcss.com/3.4.16"></script>`，版本已锁 3.4.16。
- **没有任何 `tailwind.config` 内联配置**，全用默认主题（迁移不用还原 config）。
- 使用中到重度：class 数量 bids 77 / admin 131 / japanese_learner 59 / proofreader 92，且大量 class 是 JS 模板字符串里动态拼的。
- 用到"方括号任意值"语法、响应式前缀（`sm:`）、状态前缀（`hover:`/`focus:`）；深色模式 `dark:` 零使用。
- 这 4 个页面**都不引用 `css/main.css`**，与全站手写 CSS 体系完全独立、无冲突。
- 零构建约束：`package.json` devDependencies 无 tailwindcss，scripts 无 build。

## 2. 核心决策：内容扫描小文件 + 自动检查兜底（用户已确认，含实测修正）

生成静态 CSS 原本有两条路，用户最初选"完整版一劳永逸"。但**实测发现纯完整版不可行**：Tailwind 3 是按需编译，用 `safelist: [{pattern: /.*/}]` 强行全量生成会把工具卡死（跑 2 分钟不出结果）；折中的"全色板 safelist"能跑，但文件从 20KB 涨到 **300KB（15 倍）**，且只覆盖"改颜色"、改尺寸/间距的新类照样要重新生成——大代价换不完整的好处。据此实测数据与用户重新确认，改为：

- **内容扫描小文件 + 自动检查（选定）**：用 Tailwind CLI 扫描这 4 个 HTML 文件，只生成实际用到的样式（**实测 20KB、1.4 秒、可靠**），提交进仓库。配一个 `npm run check` 里的检查兜底（见 §5）。

**为什么这满足用户真正的诉求**：用户当初选"一劳永逸"，怕的不是"多跑一条命令"本身，而是"忘了跑 → 页面静默破坏"。而 §5 的自动检查已经把"忘了跑"变成"`npm run check` 报错、明确提示跑生成命令"——**不静默、不会忘**。所以小文件方案用另一种方式实现了那个诉求，还小 15 倍、生成快、可靠。

**已实测确认内容扫描能正确捕获两类易漏的 class**（这是选它的关键前提）：
- **JS 变量拼接的动态类**：如 japanese_learner 的 `bg[v.g]` → 取值 `{1:'bg-blue-50',2:'bg-green-50',3:'bg-purple-50'}`。这些标准类名以字符串字面量出现在 JS 源码里，Tailwind 扫描器能识别并生成（实测 `bg-blue-50/green-50/purple-50` 都在产物里）。
- **方括号任意值类**：6 个（见 §3），因为在源码里字面出现，扫描时被自动捕获（实测 `.max-w-\[120px\]{max-width:120px}` 等都在产物里）。

## 3. 方括号任意值类（内容扫描已自动覆盖当前这些）

全站现有的方括号任意值类，已完整枚举，共 **6 个**：

| 类 | 出处 |
|---|---|
| `max-w-[120px]` | japanese_learner.html:107 |
| `max-w-[160px]` | admin.html:302 |
| `max-w-[180px]` | admin.html:282 |
| `min-w-[260px]` | bids/index.html:102 |
| `min-w-[540px]` | proofreader.html:331 |
| `text-[10px]` | bids/index.html:236（JS 拼的"已结束"标签里） |

**当前这 6 个由内容扫描自动捕获，无需手写**（已实测确认）。

**残留风险 + 兜底**：内容扫描只生成"当前用到"的类。以后若给这些页面**新增任何一个当前没用过的类**（普通类或方括号任意值类），它不在已生成的 CSS 里、也不会自动出现。为了让这个残留风险**不静默**，在 `npm run check` 里加检查（见 §5）：扫到"某个用到的 class 没有对应 CSS 规则"就报错提醒去跑 `npm run build:css`。这样残留风险变成"会响的错"。（对这几个很少改动的后台/工具页，实际很少触发。）

## 4. 生成工具与文件

- **工具**：`tailwindcss@3.4.16` 加进 `devDependencies`（与 eslint/prettier 同性质的开发期工具，不进部署产物）；新增 `npm run build:css` 命令负责生成。
- **生成配置**：`tailwind.config.js`（仓库根），`content` 指向这 4 个 HTML 文件，默认主题，无 safelist（实测这样就能捕获全部当前 class 含 6 个任意值 + 动态 bg 颜色）。`npm run build:css` = `tailwindcss -i <输入> -o css/tailwind.min.css --minify`。输入文件用一个含 `@tailwind base/components/utilities;` 三行指令的 CSS（如 `css/tailwind.src.css`）。
- **产物文件**：`css/tailwind.min.css`（压缩版，提交进仓库，约 20KB）。
- **4 个页面改动**：把第 7 行 `<script src="https://cdn.tailwindcss.com/3.4.16"></script>` 换成 `<link rel="stylesheet" href="/css/tailwind.min.css" />`。各页自带的 `<style>` 块（`body` 字体、`.hidden`、登录遮罩等普通 CSS）保持不变。
- **部署零构建不变**：Cloudflare 仍只服务静态文件（多了一个 CSS 文件），`build:css` 只在开发期跑。

**日常维护流程**：改这些页面**已有的**样式类 → 什么都不用做。只有两种情况才需重跑 `npm run build:css`：① 升级 Tailwind 版本；② 给页面新增了当前没用过的样式类、且 §5 检查报错提醒。两种都有提示，不会闷头忘记。

## 5. 验证策略

用户确认：做第一层 + 第三层，跳过第二层（本地目视，因用户经验有限）。

**第一层（自动化，硬门槛，接进 `npm run check` + CI）**：新增一个检查脚本，扫这 4 个页面里用到的每一个 class（包括 JS 模板字符串里的、方括号任意值的），逐个确认它在 `css/tailwind.min.css` 里有对应规则；有任何一个没规则就报错。这直接命中"某类没样式"这个静默破坏失败模式，且以后永久生效。

- 论证强度：Tailwind 运行时编译器和 CLI 静态生成对同一 class 产出同一条规则（同 3.4.16 版本），静态版功能上等价于现在运行时编译的结果；加上本检查确认无漏网，正确性论证扎实，不只是碰运气。
- 实现要点：检查脚本要提取 4 个页面里所有 class（`class="..."` 属性 + JS 模板/对象字面量里的 class 字符串），逐个核对在 `css/tailwind.min.css` 里有对应规则；核对方括号任意值类时注意 CSS 里方括号是转义的（`.max-w-\[120px\]`），比对逻辑别被转义反斜杠坑到（这是本项目 grep 假阴性的老坑）。对变量拼接、无法静态提取出完整类名的动态部分（如 `bg[v.g]` 里的 `[v.g]`），因其取值都是标准类且已被扫描捕获，不构成风险，检查可跳过这类无法静态判定的 token。

**第二层（跳过）**：本地起服务器 + 管理员登录目视对比——用户选择跳过。

**第三层（镜像恢复后，人工终检）**：镜像恢复后 4 页自然上线，用户使用时顺便终检；与 3C/3D 的人工验证排在同一队列，镜像恢复那天一起做。

## 6. 范围外（YAGNI）

- 不动 `css/main.css` 及引用它的其余页面（两套体系独立）。
- 不改这 4 个页面的任何 HTML 结构 / class / 功能逻辑，只换样式加载方式 + 处理任意值 + 加检查。
- 不做 Firebase SDK 按需加载、字体子集、图片压缩（设计文档"流畅"里的其它条目，本次不含，各自独立）。
- 不引入打包器 / 部署期构建步骤（`build:css` 只在开发期）。

## 7. 成功标准

- 4 个页面不再加载 `cdn.tailwindcss.com` 运行时编译器，改用提交进仓库的静态 `css/tailwind.min.css`。
- `npm run check` 新增的 class 覆盖检查通过：4 页所有 class（含 6 个方括号任意值类）都有对应 CSS 规则。
- 部署仍零构建；改页面已有样式类无需重新生成，只有新增当前没用过的类时检查才提醒重跑 `build:css`。
- 镜像恢复后人工终检 4 页视觉与改动前一致。
