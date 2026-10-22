// 访问统计用的「页面类别」和「从哪里来」。纯函数，tracking.js 调用，tests/page-name.test.mjs 测。
//
// 2026-10-22 从 tracking.js 拆出来时修了两处：
//   - 博客（/solutions/blog/…）被先命中的 '/solutions' 吞成了 'solutions'；
//   - 受発注 LP（/solutions/order-to-ledger）也并在 'solutions' 里，分不出产品页有没有人看。
// 顺序有意义：更具体的路径必须排在它的前缀之前。

const RULES = [
  ['japanese_learner', 'japanese_learner'],
  ['analysis', 'analysis'],
  ['lifestory', 'lifestory'],
  ['translation', 'translation'],
  ['/solutions/order-to-ledger', 'order-to-ledger'],
  ['/solutions/blog', 'blog'],
  ['/solutions/demo', 'demo-index'],
  ['/solutions', 'solutions'],
  ['/about', 'about'],
  ['/blog', 'blog'],
  ['/contact', 'contact'],
];

export function pageName(pathname) {
  for (const [needle, name] of RULES) if (pathname.includes(needle)) return name;
  return 'home';
}

// 来源：广告/邮件链接上的 utm_source 优先（如 ?utm_source=yorozu）；否则取外站 referrer 的主机名。
// 站内跳转、直接打开（书签、手输网址、多数 App 内打开）→ null，调用方不写这个字段，
// 免得同一天同一页的第二次访问用 null 盖掉第一次记下的来源（visits 是 setDoc merge）。
// 只留主机名，不留路径和查询串：路径里可能有搜索词或别人的页面信息，统计用不到。
export function visitSource(referrer, search, ownHost) {
  const utm = new URLSearchParams(search || '').get('utm_source');
  if (utm) return 'utm:' + utm.trim().toLowerCase().slice(0, 40);
  let host;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  const bare = (h) => h.replace(/^www\./, '');
  if (!host || bare(host) === bare(String(ownHost || '').toLowerCase())) return null;
  return bare(host).slice(0, 80);
}
