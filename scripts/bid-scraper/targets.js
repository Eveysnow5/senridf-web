// 招标信源配置（纯数据，无依赖）。
//
// 从 index.js 抽出来的原因：index.js 顶层 require 了 firebase-admin，
// 而它只装在本目录，仓库根跑 node --test 时 require 不到。语料库和覆盖度
// 测试需要读这份配置，所以它必须是**任何地方都能 require 的纯数据**。
//
// NOTE: 吹田市的 URL 带年度（令和8年度 = 2026），每年 4 月新年度开始时要更新。

module.exports = [
  {
    city: '大阪市',
    url: 'https://www.city.osaka.lg.jp/templates/gyomuitaku_nyusatsuanken/0-Curr.html',
    type: 'osaka',
    category: 'gyomuitaku',
    categoryLabel: '業務委託',
  },
  {
    city: '大阪市',
    url: 'https://www.city.osaka.lg.jp/templates/buppin_nyusatsuanken/0-Curr.html',
    type: 'osaka',
    category: 'buppin',
    categoryLabel: '物品供給',
  },
  {
    city: '吹田市',
    url: 'https://www.city.suita.osaka.jp/sangyo/1017983/1017993/1042102/index.html',
    type: 'suita',
    category: 'gyomuitaku',
    categoryLabel: '業務委託',
  },
  {
    city: '吹田市',
    url: 'https://www.city.suita.osaka.jp/sangyo/1017983/1017993/1042103/index.html',
    type: 'suita',
    category: 'buppin',
    categoryLabel: '物品購入',
  },
  {
    city: '豊中市',
    url: 'https://www.city.toyonaka.osaka.jp/jigyosya/keiyaku/kokokutanto/index.html',
    type: 'toyonaka',
  },
];
