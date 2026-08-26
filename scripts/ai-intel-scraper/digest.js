// 纯逻辑：每周简报提示词构造 + "只引已入库条目" 防编造校验。无网络、无 Firebase。

// 构造简报提示词：把本周入库条目全量喂进去，硬性约束只准归纳、不准编造。
function buildDigestPrompt(items, week) {
  const lines = items
    .map(
      (it, i) =>
        `${i + 1}. [${it.theme}] ${it.title}\n   摘要：${it.summary_zh}\n   链接：${it.url}`,
    )
    .join('\n');

  return `你在为「日本 AI 情报监控」生成第 ${week} 周简报。下面是本周已入库的全部情报条目：

${lines}

要求：
- 只准归纳上面列出的条目，严禁引入列表中没有的数字、事实或条目。
- 严禁夸大或拔高；拿不准就照条目原意写。
- 按三个主题分组（陪伴/介护机器人、AI 硬件/半导体、政策与监管），每组挑出值得注意的要点，每条要点后用括号附上对应条目的链接。
- 用简体中文、Markdown 格式。若某主题本周无条目，写「本周无」。`;
}

// 简报正文是**简体中文 Markdown**，所以 URL 后面紧跟中文标点是常态。
// 首版的排除集只有 `[^\s)）\]]`，于是 `…/x.html。` `…/x.html，其他` `…/x.html；B`
// 全被当成 URL 的一部分 → 对不上白名单 → **报成"引用了未入库的链接"**。
//
// 2026-08-25 补建 W33/W34 时两周都"引用校验未通过"，本地复现后确认：
// 八种真实写法里有五种被误判。**是护栏自己错了，不是模型编造。**
// （但两者不互斥——所以下面把可疑链接打进日志，让真编造也能被看见。）
// 两道处理，缺一不可：
//   1. 中文标点**根本不可能出现在 URL 里**，所以直接排除在字符类之外 ——
//      这样 `…/x.html，其他内容` 会在逗号处断开，而不是把后面一起吞进来。
//      只剥尾随标点解决不了这种"标点在中间"的形态（首次修复时漏了）。
//   2. ASCII 的 . , ; : ! ? ) ] 在 URL 里是合法字符，不能排除，
//      但结尾出现时几乎总是句读 —— 所以只在**尾部**剥掉。
const CJK_PUNCT = '，。、；：！？…（）【】「」『』《》';
const URL_RE = new RegExp(`https?://[^\\s)）\\]${CJK_PUNCT}]+`, 'g');
const TRAILING = /["'.,;:!?)\]]+$/;

/** 从 Markdown 正文里取 URL。纯函数，可单测。 */
function extractUrls(bodyMd) {
  const raw = String(bodyMd).match(URL_RE) || [];
  return [...new Set(raw.map((u) => u.replace(TRAILING, '')))].filter(Boolean);
}

// 校验简报正文里出现的 URL 是否都来自已入库条目。→ { ok, unknownUrls }。
function validateDigestCitations(bodyMd, items) {
  const allowed = new Set(items.map((it) => it.url));
  const unknownUrls = extractUrls(bodyMd).filter((u) => !allowed.has(u));
  return { ok: unknownUrls.length === 0, unknownUrls };
}

module.exports = { buildDigestPrompt, validateDigestCitations, extractUrls };
