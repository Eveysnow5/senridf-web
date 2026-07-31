// 日本 AI 情报信源配置。增删源改这里即可。
// type: 'rss'（feed）| 'list'（官方 HTML 列表页，需 linkSelector + base）。
// theme_hint 仅供人阅读参考；实际主题由 Qwen 判定决定，不受此值约束。
module.exports = [
  // ── 陪伴 / 介护机器人 ──
  // 2026-07-31 冒烟测试：/feed 404，homepage <link rel=alternate> 指向以下真实地址（200, application/xml）。
  {
    name: 'ロボスタ',
    type: 'rss',
    url: 'https://robotstart.info/rss20/index.rdf',
    theme_hint: 'companion',
  },
  { name: 'PR TIMES', type: 'rss', url: 'https://prtimes.jp/index.rdf', theme_hint: 'companion' },

  // ── AI 硬件 / 半导体 ──
  {
    name: 'ITmedia AI+',
    type: 'rss',
    url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',
    theme_hint: 'hardware',
  },
  // TODO: verify/replace — /ja/news/feed/ 返回 404，homepage/news 页均未发现 <link rel=alternate> 或
  // 其他 feed 端点，PFN 官网可能已不提供 RSS。暂留占位，index.js 首次抓取若持续失败考虑改用官方 X/note 号或删除此源。
  {
    name: 'Preferred Networks',
    type: 'rss',
    url: 'https://www.preferred.jp/ja/news/feed/',
    theme_hint: 'hardware',
  },

  // ── 政策 / 监管 ──（官方列表页，逐条冒烟验证 selector）
  // TODO: 无 User-Agent 头时返回 403（axios 默认无 UA 会被拒），加浏览器 UA 头后为 200。
  // index.js 实现抓取 meti 时务必设置类似 'Mozilla/5.0 ...' 的 User-Agent。
  {
    name: '経産省ニュースリリース',
    type: 'list',
    url: 'https://www.meti.go.jp/press/index.html',
    linkSelector: '#maincontents a, #main a, .press a',
    base: 'https://www.meti.go.jp/press/',
    theme_hint: 'policy',
  },
];
