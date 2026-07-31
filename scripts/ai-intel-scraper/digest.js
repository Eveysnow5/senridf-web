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

// 校验简报正文里出现的 URL 是否都来自已入库条目。→ { ok, unknownUrls }。
function validateDigestCitations(bodyMd, items) {
  const allowed = new Set(items.map((it) => it.url));
  const urls = bodyMd.match(/https?:\/\/[^\s)）\]]+/g) || [];
  const unknownUrls = [...new Set(urls)].filter((u) => !allowed.has(u));
  return { ok: unknownUrls.length === 0, unknownUrls };
}

module.exports = { buildDigestPrompt, validateDigestCitations };
