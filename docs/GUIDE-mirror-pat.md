# 授权指引：让网站更新自动上线（MIRROR_PAT 生成步骤）

> 本文给 **`Eveysnow5`（仓库 `Eveysnow5/senridf-web` 的所有者）** 看。
> 全程约 3 分钟，只在你自己的 GitHub 账号里操作，不需要动 Cloudflare。

---

## 一、这是在做什么

网站 `www.senridf.com` 的上线链路是这样的：

```
我 push 代码 → sherlockafa007/senridoufuu-web
                    ↓  ← 就是这一步需要你的授权
              Eveysnow5/senridf-web（你的仓库）
                    ↓  自动触发
              你的 Cloudflare 账号构建 → 网站更新
```

中间那一步由一个自动化脚本完成，它需要一把"钥匙"才能把代码写进你的仓库。这把钥匙就是下面要生成的 **fine-grained personal access token（细粒度个人访问令牌）**。

**为什么必须由你来生成，我不能自己弄：**
GitHub 的细粒度令牌有一条硬规则——**只有仓库的所有者本人，才能创建针对该仓库的令牌**。`senridf-web` 在你的账号下，所以只有你登录你自己的 GitHub 才能生成。我在我的账号里怎么找都找不到、也造不出这把钥匙。（这一点之前误解过一次，白折腾了很久，所以特别说明。）

**这把钥匙的权限范围：** 只能读写 `Eveysnow5/senridf-web` 这一个仓库，碰不到你账号下的任何其他东西。你随时可以在同一个页面点 `Delete` 撤销它。

---

## 二、生成步骤

### 1. 打开创建页面

登录 GitHub 后，直接访问这个链接最快：

**https://github.com/settings/personal-access-tokens/new**

（手动点的话：右上角头像 → **Settings** → 左侧栏拉到最底 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → 右上角 **Generate new token**）

> ⚠️ 注意是 **Fine-grained tokens**，不是它下面那个 `Tokens (classic)`。

### 2. 按下面这张表填写

| 项目 | 填什么 | 说明 |
|---|---|---|
| **Token name** | `senridf-mirror` | 名字随意，但建议用这个，方便以后认出来 |
| **Resource owner** | **`Eveysnow5`**（你自己） | ⚠️ **最关键的一项**，必须是你的账号 |
| **Expiration** | 选 `Custom` → 把日期设成 **一年后**（GitHub 上限 366 天） | ⚠️ **不要用默认的 30 天**。上次就是默认了 30 天，一个月后悄悄失效，网站更新卡住了才发现 |
| **Description** | `senridoufuu-web 自动镜像用` | 可留空 |

### 3. Repository access（仓库范围）

选中间那项 **`Only select repositories`**，然后在下拉框里选 **`senridf-web`**。

> 只选这一个。别选 `All repositories`。

### 4. Permissions（权限）

这一节默认是**空的**——会显示 `Repositories 0` / `Account 0` 和一句 "No repository permissions added yet"。权限不是从现成的列表里挑，而是要**自己一项一项加进来**：

1. 点右上角的 **`+ Add permissions`** 按钮
2. 弹出的搜索框里输入 **`Contents`**，选中它
3. 再点一次 `+ Add permissions`，输入 **`Workflows`**，选中它
4. 这两项现在会出现在 `Repositories` 标签页下，每项右边有个访问级别下拉框——**两项都要选成 `Read and write`**（默认可能是 `Read-only`，一定要改）

**加完后的自查：** 顶上那个计数应该从 `Repositories 0` 变成 **`Repositories 2`**（如果系统自动带上了 `Metadata`，显示 3 也正常，Metadata 是强制项、不能取消，不用管）。`Account` 保持 0 不动。

> 💡 **Workflows 这项别漏掉。** 它管的是 `.github/workflows/` 目录下的文件。只要我某次更新碰到了那个目录，而令牌没有这个权限，**整次推送会被 GitHub 整个拒绝**（不是只跳过那个文件），网站就更新不了。这个坑我们踩过。

### 5. 生成并复制

拉到页面最底部，点 **`Generate token`**。

生成后页面顶部会出现一串 **`github_pat_` 开头的字符**——**立刻复制它**。

> 🔴 **这串字符只显示这一次**，刷新或离开页面后 GitHub 再也不会显示第二遍。万一没存到，回列表页对这个 token 点 `Regenerate` 重新生成一个即可，不用重新走一遍配置。

### 6. 把它发给我

私下发给我就行（微信私聊 / 邮件均可）。

- ❌ 不要发到公开的群、GitHub issue、或任何会被搜索到的地方
- ✅ 如果不小心发错地方了，直接来这个页面把它 `Delete` 掉，再生成一个新的，旧的立刻作废，没有其他影响

---

## 三、发给我之后

剩下的我来做，你不用再操作：

1. 我把它存进 `sherlockafa007/senridoufuu-web` 的仓库 Secret（名字叫 `MIRROR_PAT`），存进去之后连我自己也看不到明文
2. 我推一个真实改动做验证，确认代码确实同步进了你的仓库、Cloudflare 也确实触发了构建
3. 验证通过后我告诉你一声，之后 **你就完全不用管了**——不需要再手动点 "Sync fork"，我 push 完几分钟内网站自动更新

---

## 四、一年后

令牌到期前 GitHub 会发邮件提醒你。到期后重新走一遍第二节即可（或者在令牌列表页对它点 `Regenerate`，配置会保留，只换一串新字符），然后把新字符再发我一次。

到期时的症状是：我 push 了代码，但网站一直不更新。如果哪天出现这个情况，先怀疑这里。

---

## 五、一眼自查清单

生成前对着这五条核一遍，避开所有已知的坑：

- [ ] 页面标题是 **Fine-grained** token，不是 classic
- [ ] Resource owner = **Eveysnow5**（你自己的账号）
- [ ] Expiration = **一年**，不是默认的 30 天
- [ ] Repository access = Only select repositories → **只勾 `senridf-web`**
- [ ] Permissions 里通过 `+ Add permissions` 加了 **Contents** 和 **Workflows**，且**两项都是 Read and write**（不是 Read-only）
- [ ] 点 Generate token 之前，Permissions 顶上显示的是 **`Repositories 2`**（或 3），**不是 `0`**

---

*相关背景见 [TOOLS.md](TOOLS.md) 第 0 节「全站部署与架构总览」。*