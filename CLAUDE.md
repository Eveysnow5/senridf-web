# CLAUDE.md

千里同風株式会社官网 senridf.com 的仓库。**推到 `main` 的提交约 1 分钟后自动上线，中间没有人工审核**，所以下面这几条规则就是审核本身。
这个仓库由两个人、两台电脑上的 Claude Code 一起改（sherlockafa 与 Yuki）。双方读的都是这一份文件，规则以这里为准。

## 协作规则

每条后面的「起因」是真实发生过的事故，用来判断边界情况。

1. **开工先 `git pull`；要改动一个已有文件，先看它最近的历史。**
   `git log -5 --format='%h %ad %an %s' -- <文件>`。最近有人改过的页面，在它现有内容上改，保留原有功能（表单、脚本、三语键）。
   起因：2026-10-07，/contact 被一个通用模板整页覆盖，3 小时前刚做好、能提交的咨询表单变成了不提交任何地方的表单，咨询丢了 11 天。

2. **推送前跑 `npm run check`，全部通过再推。** 测试失败时，改代码让它通过；如果确认是测试本身过时了，在提交说明里写清楚改了哪条测试、为什么。
   起因：2026-10-10，测试报「中文缺一个键」，修法是把日文原句复制进中文键——测试通过了，中文页显示日文。

3. **页面上看得见的每个字都走三语。** 在 `js/main.js` 的 `T.ja` / `T.zh` / `T.en` 里各写一条（各自是那种语言的真正翻译；日文用です・ます体），元素上写 `data-i18n="键名"`。
   placeholder / title / alt 用 `data-i18n-placeholder` / `data-i18n-title` / `data-i18n-alt`；脚本里动态写进页面的文字用 `window.sdfSetText(el, '键名', 参数)` 或 `window.sdfT('键名')`。
   故意不翻译的内容（示例原文、人名缩写）在元素上加 `translate="no"`。
   `tests/i18n-value-lang.test.mjs` 和 `tests/public-pages-i18n.test.mjs` 会检查这一条。
   起因：/solutions/automation 整页写死日文，切到中文、英文都不变（已于 2026-10-19 删除）。

4. **首页、关于我们、大事记、解决方案这几页的文字用后台 `/admin` 改。** 后台的改动存进 `content.json`，优先于 `T` 里的同名键。在后台改完中文后点「一键同步日英」再「保存并发布」；后台顶部的「日英还是旧的」提示出现时，点同步补上。
   起因：只改了中文、没同步日英，日文和英文页面长期显示旧的团队简介。

5. **对外文案里的数字要有真实出处**（价格、效果、客户数、「节省 X%」「每月 ¥X」）。没有出处的数字不写进页面。
   起因：已删除的 automation 页写着「每月节省 ¥190 万」「存储节省 30%+」，找不到任何来源。

6. **收邮箱的表单统一接到咨询系统：** `<form data-lead-form data-lead-source="来源名">`，页面加载 `js/tracking.js`（type="module"）和 `js/lead-form.js`。参考 `contact.html`。

7. **删除或整页替换页面、改导航、改表单提交、改登录这类大改动，先和对方确认再动手。** 提交说明写清楚：改了什么、为什么、怎么验证的。

## 常用命令

```bash
npm install          # 第一次
npm run check        # 推送前必跑：eslint + prettier + 全部单测 + 死链/alt 扫描 + CSS 类检查
npm run bust         # 改了 js/main.js、css/main.css 等之后刷新各页面引用里的 ?v= 指纹（check 会提示）
npm run meta         # 新增页面或改了页面标题/描述后，重新生成 <head> 里的 SEO 信息
npx prettier --write <文件>   # check 报格式问题时
```

本地预览：在仓库根目录 `python -m http.server 8000`，打开 http://localhost:8000 。切语言可以在网址后加 `?lang=zh` / `?lang=en`。

## 结构

纯静态站：HTML + `css/main.css` + `js/main.js`，没有打包步骤。

```
index.html, about/, contact.html, privacy/, solutions/   ← 公开页面（清单见 sitemap.xml）
solutions/demo/*.html      ← 在线工具（登录后可用，登录门控在 js/shared/auth-gate.js）
account.html               ← 会员登录/注册（自带一份三语文案）
admin/                     ← 后台（内容编辑、博客、线索）；保存走 workers/sdf-admin
js/main.js                 ← 三语文案 T、共用导航/页脚注入、入场动画、content.json 覆盖
js/shared/                 ← 各工具共用模块（Firebase、登录门控、管理员名单 admins.js 等）
functions/api/             ← Cloudflare Pages Functions（/api/*，全部要求 Firebase 登录）
workers/sdf-admin/         ← 后台保存服务（Cloudflare Worker，单独用 wrangler 部署，不随 push 上线）
content.json               ← 后台写入的文案/图片/大事记覆盖
tests/                     ← node --test 单测（npm run check 会跑）
_redirects                 ← Cloudflare 跳转规则（下线页面的旧网址在这里 301）
```

### 新增一个公开页面

1. 复制一个现有页面（如 `contact.html`）当起点：`<base href>` 按目录深度写（根目录 `./`，一层 `../`）。
2. 导航和页脚由 `js/main.js` 的 `NAV_HTML` / `FOOTER_HTML` 注入，页面里只放 `<div id="nav-placeholder">` / `<div id="footer-placeholder">`。
3. `<body data-page-title="键名">`，标题三语写进 `T`。
4. 加进 `sitemap.xml` 和 `tests/exposure-surface.test.mjs`，跑 `npm run meta`、`npm run bust`、`npm run check`。

### 下线一个页面

删文件后在 `_redirects` 里把旧网址 301 到最接近的现行页面，并从 `sitemap.xml`、`tests/exposure-surface.test.mjs` 里移除。

## 后端与部署

- `functions/api/*` 由 `functions/api/_middleware.js` 统一要求 Firebase ID token；前端用 `apiFetch` 带上。密钥（`QWEN_API_KEY`、`DEEPGRAM_API_KEY` 等）只放在 Cloudflare Pages 的环境变量里。
- 部署链：推到 GitHub `sherlockafa007/senridoufuu-web` 的 `main` → `.github/workflows/sync-upstream.yml` 镜像到部署仓库 → Cloudflare Pages 构建 → senridf.com。
- `workers/sdf-admin` 改了之后要 `cd workers/sdf-admin && npx wrangler deploy`（需要 sherlockafa 的 Cloudflare 账号），否则线上后台还是旧版本。
- `netlify/`、`netlify.toml` 若出现在旧文档里，是迁移到 Cloudflare 之前的遗留，已不使用。
