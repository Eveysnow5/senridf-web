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

## 2. 核心决策：完整版 CSS，一劳永逸（用户已确认）

生成静态 CSS 有两条路，用户选了后者：

- ~~小文件 + 自动拦截~~：只生成实际用到的样式，文件小，但以后加新样式类要重跑生成命令（有检查兜底不会静默，但仍是一道步骤）。
- **完整版 + 一劳永逸（选定）**：一次性生成"完整版 Tailwind 标准 CSS"（含所有标准工具类），提交进仓库。以后改这些页面的普通样式类**永远不用重新生成**。

**为什么这个选择对"静默破坏"友好**：完整版里所有标准类都在，那些 JS 用变量拼出来的 class（如 japanese_learner 的 `bg[v.g]` → `{1:'bg-blue-50',2:'bg-green-50',3:'bg-purple-50'}`，都是标准类）自动都有样式，不存在"扫漏导致某元素静默丢样式"。

## 3. 唯一的例外：方括号任意值类

完整版 CSS **不包含**"方括号任意值"类（如 `max-w-[120px]`），因为任意值是无限的（`[任何值]`），没法预先全生成——它们本来就是 Tailwind 运行时按源码里的具体值即时生成的。

全站现有的方括号任意值类，已完整枚举，共 **6 个**：

| 类 | 出处 |
|---|---|
| `max-w-[120px]` | japanese_learner.html:107 |
| `max-w-[160px]` | admin.html:302 |
| `max-w-[180px]` | admin.html:282 |
| `min-w-[260px]` | bids/index.html:102 |
| `min-w-[540px]` | proofreader.html:331 |
| `text-[10px]` | bids/index.html:236（JS 拼的"已结束"标签里） |

**处理方式**：生成完整版 CSS 时，让生成工具的 content 扫描同时覆盖这 4 个 HTML 文件——这样**当前**这 6 个任意值类会被工具自动捕获、一并生成进 CSS，不用手写。（即：CSS = 完整标准类〔set-and-forget〕 + 当前 4 页用到的任意值类〔扫描捕获〕。）

**唯一残留风险 + 兜底**：以后若**新增**一个方括号任意值类（如某天写个 `w-[137px]`），它不在已生成的 CSS 里、也不会自动出现。为了让这个残留风险**不静默**，在 `npm run check` 里加一个检查（见 §5），扫到"某方括号类没有对应 CSS 规则"就报错提醒。这样连这个唯一残留风险都变成"会响的错"。

## 4. 生成工具与文件

- **工具**：`tailwindcss@3.4.16` 加进 `devDependencies`（与 eslint/prettier 同性质的开发期工具，不进部署产物）；新增 `npm run build:css` 命令负责生成。
- **生成内容**：完整标准工具类（通过 Tailwind config 的 safelist 全量模式或等价手段）+ content 扫描 4 个 HTML 文件（捕获当前任意值类）。实施时须验证生成结果确实覆盖 4 页所有 class（由 §5 的检查保证）。
- **产物文件**：`css/tailwind.min.css`（压缩版，提交进仓库）。
- **4 个页面改动**：把第 7 行 `<script src="https://cdn.tailwindcss.com/3.4.16"></script>` 换成 `<link rel="stylesheet" href="/css/tailwind.min.css" />`。各页自带的 `<style>` 块（`body` 字体、`.hidden`、登录遮罩等普通 CSS）保持不变。
- **部署零构建不变**：Cloudflare 仍只服务静态文件（多了一个 CSS 文件），`build:css` 只在开发期跑。

**日常维护流程**：改这些页面的普通样式类 → 什么都不用做。只有两种情况才需重跑 `npm run build:css`：① 升级 Tailwind 版本；② 新增方括号任意值类且检查报错提醒。两种都有提示，不会闷头忘记。

## 5. 验证策略

用户确认：做第一层 + 第三层，跳过第二层（本地目视，因用户经验有限）。

**第一层（自动化，硬门槛，接进 `npm run check` + CI）**：新增一个检查脚本，扫这 4 个页面里用到的每一个 class（包括 JS 模板字符串里的、方括号任意值的），逐个确认它在 `css/tailwind.min.css` 里有对应规则；有任何一个没规则就报错。这直接命中"某类没样式"这个静默破坏失败模式，且以后永久生效。

- 论证强度：Tailwind 运行时编译器和静态完整版对同一 class 产出同一条规则（同 3.4.16 版本），静态版功能上等价于现在运行时编译的结果；加上本检查确认无漏网，正确性论证扎实，不只是碰运气。
- 实现要点：class 提取要能处理 JS 模板字符串里的 class（不只是 `class="..."` 属性）；对变量拼接的动态类（如 `bg[v.g]`）无法静态提取的部分，因完整版已含所有标准类，不构成风险；方括号任意值类必须逐个核对（这是唯一真正需要保证覆盖的部分）。

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
- 部署仍零构建；日常改普通样式类无需重新生成。
- 镜像恢复后人工终检 4 页视觉与改动前一致。
