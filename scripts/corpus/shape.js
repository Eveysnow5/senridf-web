// 一份真实快照的「结构形状」：解析结果里可以断言、且在信源改版时会变的量。
// 纯函数，无网络、无文件系统 —— 语料库快照脚本和离线测试共用同一套计算，
// 否则"抓的时候算一套、测的时候算另一套"，两边都以为对方在把关。
//
// ── 为什么不用字节 hash 当告警 ──────────────────────────────────────────────
// 新闻 feed 的内容每小时都在变，字节 hash 必然天天不同。天天报警 = 没有报警
// （ai-intel 静默退化四周，正是"告警疲劳"的代价）。真正要盯的是**结构**：
// 还能不能解析出条目、字段还在不在、URL 还是不是我们要的那种。
// hash 仍然记录，但它的用途是**溯源**（这份语料是哪一版），不是告警。

// METI 的真新闻稿 URL 形如 /press/2026/08/20260826001.html。
// 分类导航（category_03.html）、English、archive、外站 NDL 都不长这样。
const METI_PRESS_PATH = /\/press\/\d{4}\/\d{2}\/\d+\.html$/;

function ratio(n, d) {
  return d ? Math.round((n / d) * 100) : 0;
}

/** feed 解析结果 → 形状。 */
function feedShape(items) {
  const n = items.length;
  return {
    kind: 'feed',
    items: n,
    pct_title: ratio(items.filter((i) => i.title && i.title.trim()).length, n),
    pct_url: ratio(items.filter((i) => /^https?:\/\//.test(i.url || '')).length, n),
    pct_date: ratio(items.filter((i) => i.published_at).length, n),
    pct_raw: ratio(items.filter((i) => i.raw && i.raw.trim()).length, n),
  };
}

/** 官方列表页解析结果 → 形状。pct_article 是"看起来像正文而非导航"的比例。 */
function listShape(links) {
  const n = links.length;
  return {
    kind: 'list',
    items: n,
    pct_title: ratio(links.filter((l) => l.title && l.title.trim()).length, n),
    pct_url: ratio(links.filter((l) => /^https?:\/\//.test(l.url || '')).length, n),
    pct_article: ratio(links.filter((l) => METI_PRESS_PATH.test(l.url || '')).length, n),
  };
}

/** 招标解析结果 → 形状。 */
function bidShape(bids) {
  const n = bids.length;
  return {
    kind: 'bid',
    items: n,
    pct_title: ratio(bids.filter((b) => b.title && b.title.trim()).length, n),
    pct_url: ratio(bids.filter((b) => /^https?:\/\//.test(b.source_url || '')).length, n),
    pct_deadline: ratio(bids.filter((b) => b.deadline).length, n),
  };
}

// ── 形状比对 ───────────────────────────────────────────────────────────────
// 阈值**刻意定得粗**。只在一个样本上调出来的精细阈值必崩（同一个源不同时段的
// 条目数、字段齐全度本来就有正常波动），所以这里只抓"结构塌了"这一档：
//   - 一条都解析不出来
//   - 条目数掉到记录值的一半以下
//   - 某个字段的覆盖率掉了 40 个百分点以上
// 反过来，**变多永远不报警** —— 信源发得多、字段变全，都是好事。
const MIN_ITEMS_FRACTION = 0.5;
const RATIO_DROP_LIMIT = 40;

/**
 * 比对记录的形状与实时形状，返回退化描述数组（空数组 = 没退化）。
 * @returns {string[]}
 */
function compareShape(recorded, live) {
  const out = [];
  if (!recorded) return out;

  if (live.items === 0) {
    out.push(`一条都没解析出来（记录值 ${recorded.items} 条）`);
    return out; // 全塌了，再报字段比例没有意义，只会淹没这一条
  }
  if (live.items < Math.floor(recorded.items * MIN_ITEMS_FRACTION)) {
    out.push(`条目数 ${recorded.items} → ${live.items}，少了一半以上`);
  }
  for (const key of Object.keys(recorded)) {
    if (!key.startsWith('pct_')) continue;
    const before = recorded[key];
    const after = live[key];
    if (typeof after !== 'number') {
      out.push(`${key} 这一项不见了 —— 形状定义变了，语料库要重新采`);
      continue;
    }
    if (before - after >= RATIO_DROP_LIMIT) {
      out.push(`${key} ${before}% → ${after}%，掉了 ${before - after} 个百分点`);
    }
  }
  return out;
}

module.exports = {
  feedShape,
  listShape,
  bidShape,
  compareShape,
  METI_PRESS_PATH,
  MIN_ITEMS_FRACTION,
  RATIO_DROP_LIMIT,
};
