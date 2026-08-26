const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { validateDigestCitations, extractUrls } = require('../scripts/ai-intel-scraper/digest');

// 这条校验是简报的**唯一防编造机制**：它保证简报里出现的每个链接都来自本周
// 已入库的条目。对"可溯源的情报库"来说，它比简报本身更重要。
//
// 但 2026-08-25 补建 W33/W34 时两周都报"引用校验未通过"，而**是护栏自己错了**：
// 简报是简体中文 Markdown，URL 后面紧跟中文标点是常态，而首版的字符类
// `[^\s)）\]]` 不含中文标点，于是 `…/x.html。` `…/x.html，其他` 全被当成 URL
// 的一部分 → 对不上白名单 → 误报成"引用了未入库的链接"。
//
// 误报的代价不只是白紧张：**狼来了几次之后，真的编造就没人信了。**
const ROOT = path.join(__dirname, '..');
const REAL = 'https://robotstart.info/2026/08/20/ugo-pro.html';
const ITEMS = [{ url: REAL }];

// ── 不该误报的：简报里 URL 的各种真实写法 ──────────────────────────────────
const LEGIT = {
  '括号内（提示词要求的标准形式）': `- 某要点（${REAL}）`,
  中文句号结尾: `- 某要点（${REAL}。）`,
  中文逗号后接文字: `- 某要点（${REAL}，另见下条）`,
  顿号: `- 某要点（${REAL}、）`,
  分号后接文字: `- A（${REAL}；B 见后）`,
  行尾无标点: `- 某要点 ${REAL}`,
  'Markdown 链接语法': `- 某要点（[来源](${REAL})）`,
  句末中文句号: `- 某要点，见 ${REAL}。`,
  全角括号包裹: `- 某要点（详见：${REAL}）`,
  // 下面两种专测**剥尾随 ASCII 标点**那一段。排除中文标点之后，中文那几种
  // 在标点处就断开了，于是 TRAILING 一度没有任何测试覆盖 ——
  // 突变验证把它删掉，全部测试照样绿。补上这两种才守得住。
  'ASCII 句点结尾': `- 某要点 ${REAL}.`,
  英文双引号包裹: `- 某要点 "${REAL}"`,
};

test('★ 中文标点不该把 URL 判成"未入库"—— 首版八种写法里误判五种', () => {
  const bad = [];
  for (const [name, body] of Object.entries(LEGIT)) {
    const r = validateDigestCitations(body, ITEMS);
    if (!r.ok) bad.push(`${name} → ${r.unknownUrls.join(', ')}`);
  }
  assert.deepEqual(bad, [], `这些真实写法被误判成编造：\n${bad.join('\n')}`);
});

// ── 该抓到的：真正的编造 ───────────────────────────────────────────────────
// 反向对照必须有，否则"把所有 URL 都放行"也能让上面那条全绿。
const FABRICATED = {
  别的站点: '- 要点（https://example.com/fake）',
  同站但路径不同: '- 要点（https://robotstart.info/2026/08/20/OTHER.html）',
  链接被截断: '- 要点（https://robotstart.info/2026/08/20/）',
  真实与编造混排: `- A（${REAL}）；- B（https://fake.jp/x）`,
};

test('★ 反向：真正编造的链接仍然要被抓到', () => {
  const missed = [];
  for (const [name, body] of Object.entries(FABRICATED)) {
    if (validateDigestCitations(body, ITEMS).ok) missed.push(name);
  }
  assert.deepEqual(missed, [], `这些编造没被抓到：${missed.join(', ')}`);
});

test('抓到时要说出是哪个链接，不能只给一个 false', () => {
  const r = validateDigestCitations('- 要点（https://fake.jp/x）', ITEMS);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unknownUrls, ['https://fake.jp/x']);
});

test('extractUrls：去重，且不产出空串', () => {
  const urls = extractUrls(`${REAL} 又一次 ${REAL}。 还有 https://a.jp/b，`);
  assert.deepEqual(urls.sort(), [REAL, 'https://a.jp/b'].sort());
  assert.ok(!urls.includes(''), '不该有空串');
});

test('正文为空或没有链接时不抛错', () => {
  assert.doesNotThrow(() => validateDigestCitations('', ITEMS));
  assert.equal(validateDigestCitations('本周无', ITEMS).ok, true);
  assert.equal(validateDigestCitations(null, ITEMS).ok, true);
});

// ASCII 的 . , : ; 在 URL 里合法，只有出现在**结尾**才当句读。
// 带查询串的链接是现实中常见的（经产省的公告页就有），必须能通过。
test('带查询串和逗号的 URL 不能被切断', () => {
  const items = [{ url: 'https://www.meti.go.jp/press/2026/08/a.html?id=1,2&kind=ai' }];
  assert.ok(
    validateDigestCitations(`- 要点（${items[0].url}）`, items).ok,
    '带查询串的链接被切断了',
  );
});

// ⚠️ 已知取舍，写下来免得以后被当成 bug 反复查：
// **URL 里的 ASCII 右括号 `)` 不被支持**。因为简报里链接的标准形式就是被括号
// 包着（`（url）` 或 Markdown 的 `[文字](url)`），不排除 `)` 的话括号本身会被
// 吞进 URL —— 那是更常见、代价更大的错。
// 真出现含 `)` 的来源链接，症状是它被判成"未入库"，届时按这条注释处理。
test('已知不支持：URL 内部含 ASCII 右括号', () => {
  const items = [{ url: 'https://example.jp/a(b)c' }];
  const r = validateDigestCitations(`- 要点（${items[0].url}）`, items);
  assert.equal(r.ok, false, '如果这条开始通过了，说明取舍变了，请更新上面的说明');
});

// ── 接线 ──────────────────────────────────────────────────────────────────
test('两个入口都会把可疑链接打进日志', () => {
  for (const f of ['index.js', 'rebuild-digest.js']) {
    const s = readFileSync(path.join(ROOT, 'scripts', 'ai-intel-scraper', f), 'utf8');
    assert.match(
      s,
      /if \(!ok\) console\.log\([^)]*unknownUrls/,
      `${f} 只说"未通过"而不列出链接 —— 无法区分模型编造与校验器误报`,
    );
  }
});
