// 语料库目标清单：**从真实信源配置派生**，不另抄一份 URL。
//
// 为什么必须派生：抄一份必然烂掉 —— 有人改了 sources.js，语料库还盯着老地址，
// 于是"测试全绿"和"线上抓的东西"指的不是同一件事。这正是我们要根除的那类假绿。
//
// 派生带来的约束：新增一个信源，这里会自动多出一个目标，而语料库里没有对应快照
// → 覆盖度测试变红，逼着人补采。要跳过必须在 WAIVED 里写明理由和日期，
// 让"这个源我们故意不采"变成代码里看得见的事实，而不是一条天天响的告警。

const aiIntelSources = require('../ai-intel-scraper/sources');
const bidTargets = require('../bid-scraper/targets');
const { parseFeed, parseListLinks } = require('../ai-intel-scraper/parse');
const { parseOsakaBids, parseSuitaBids, parseToyonakaLinks } = require('../bid-scraper/parse');
const { feedShape, listShape, bidShape } = require('./shape');

// 没有 UA 头时経産省直接 403（sources.js 里记着这一条），语料库必须用同样的头，
// 否则采到的是错误页，而线上抓的是真页面 —— 语料就不是"生产路径上的东西"了。
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

// 故意不采的源。key = 目标 id，value = 理由（写清日期，方便日后判断该不该复活）。
const WAIVED = {
  'ai-intel/preferred':
    'PFN 官网自 2026-07-31 起就没有 feed：/ja/news/feed/ 308 跳转后仍 404，' +
    '首页也没有 <link rel=alternate>。2026-08-26 复查依旧。采不到，等换源或删源。',
};

/** 从 URL 取一个稳定的 ASCII 短名（日文源名不能当文件名）。 */
function slugOf(url) {
  const host = new URL(url).hostname.replace(/^(www|rss)\./, '');
  return host.split('.')[0];
}

function aiIntelTargets() {
  return aiIntelSources.map((src) => {
    const slug = slugOf(src.url);
    const isFeed = src.type === 'rss';
    return {
      id: `ai-intel/${slug}`,
      file: `ai-intel/${slug}.${isFeed ? 'xml' : 'html'}`,
      url: src.url,
      headers: { 'User-Agent': UA },
      label: src.name,
      shapeOf: isFeed
        ? (text) => feedShape(parseFeed(text))
        : (text) =>
            listShape(parseListLinks(text, { linkSelector: src.linkSelector, base: src.base })),
    };
  });
}

function bidCorpusTargets() {
  return bidTargets.map((t) => {
    const slug = t.category ? `${t.type}-${t.category}` : t.type;
    const parse = { osaka: parseOsakaBids, suita: parseSuitaBids, toyonaka: parseToyonakaLinks }[
      t.type
    ];
    if (!parse) throw new Error(`招标信源 type=${t.type} 没有对应解析器`);
    return {
      id: `bids/${slug}`,
      file: `bids/${slug}.html`,
      url: t.url,
      headers: { 'User-Agent': UA },
      label: `${t.city}/${t.categoryLabel || '全部'}`,
      // 豊中市那支返回的是链接列表（还没有 deadline），形状按 list 之外的
      // bid 口径算即可 —— 它同样有 title/source_url。
      //
      // ⚠️ `includeExpired`：体检要量的是**信源的结构**，不是我们过滤后剩下什么。
      // 吹田那支的解析器会丢掉截止超过 7 天的标 —— 那是业务逻辑，而且**跟当前时间挂钩**。
      // 用它的输出跟半个月前的快照比，条数必然衰减：08-26 记 7 条、09-07 只剩 2 条，
      // 而页面上一直有 35 行。体检因此报"少了一半"，是误报，而且会一直报。
      //
      // ⚠️ 但这个数**一年会合法地掉一次**：吹田那页是「令和N年度〜一覧」，
      // 整个年度累加，到 4 月换年度时清空重来。那时体检会报"少了一半"，
      // 那次**不是误报也不是改版** —— 确认页面确实换了年度之后，用 --apply 重采即可。
      shapeOf: (text) => bidShape(parse(text, t, { includeExpired: true })),
    };
  });
}

/** 全部目标（含被 waive 的，调用方自己按 WAIVED 过滤）。 */
function allTargets() {
  const list = [...aiIntelTargets(), ...bidCorpusTargets()];
  const seen = new Set();
  for (const t of list) {
    if (seen.has(t.id)) {
      throw new Error(`目标 id 撞车：${t.id} —— 两个信源推出了同一个短名，必须手工消歧`);
    }
    seen.add(t.id);
  }
  return list;
}

/** 该采的目标（去掉 WAIVED）。 */
function activeTargets() {
  return allTargets().filter((t) => !WAIVED[t.id]);
}

module.exports = { allTargets, activeTargets, WAIVED, slugOf, UA };
