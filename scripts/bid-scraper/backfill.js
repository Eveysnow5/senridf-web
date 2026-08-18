// 回填「已入库但摘要为空」的招标条目。
//
// 修的是什么：`translate()` 失败时条目**仍会入库**，只是 summary_zh 为空；
// 而主库去重会让它此后再也不会被重译——页面上那条招标永远没有中文摘要。
// 2026-08-17 已给夜间流程加了轮内重试（挡住新发生的），存量这批需要单独跑一次。
//
// ⚠️ 这个脚本会**烧额度**，所以：
//   · 默认 dry-run，只报数不写库、不调用 LLM
//   · 真跑要显式 --apply，且有 --limit 上限（默认 20），不会一口气把桶喝干
//   · 模型判定 NOT_A_BID 的条目打标记，避免每次回填都重试同一批垃圾页

// ⚠️ 重依赖（firebase-admin / axios / cheerio）只装在爬虫目录里，仓库根 require 不到。
// 放在模块顶层会让 tests/ 里 require 本文件时直接炸——CI 从根跑 node --test，
// 本地也一样。所以纯函数留在顶层，重依赖一律延迟到 main() 里再取。

const DEFAULT_LIMIT = 20;

/**
 * 判断一条记录是否需要回填。纯函数，便于测试。
 * ⚠️ 空白字符串也算空——`'  '` 在页面上和空的没区别。
 * ⚠️ 已标记为 NOT_A_BID 的不再重试，否则每次回填都白烧一遍。
 */
function needsBackfill(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.summary_skipped) return false;
  const s = doc.summary_zh;
  return typeof s !== 'string' || s.trim() === '';
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const i = argv.indexOf('--limit');
  const raw = i >= 0 ? Number(argv[i + 1]) : NaN;
  const limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LIMIT;
  return { apply, limit };
}

async function main() {
  const admin = require('firebase-admin');
  const { translateWithRetry, usageAcc } = require('./index.js');
  const { formatUsage } = require('../_lib/llm-usage');

  const { apply, limit } = parseArgs(process.argv.slice(2));
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  // Firestore 查不了"字段为空字符串"，所以全量取回本地筛。bids 量级不大（数百）。
  const snap = await db.collection('bids').get();
  const targets = snap.docs.filter((d) => needsBackfill(d.data()));

  console.log(`库内 ${snap.size} 条，其中缺摘要 ${targets.length} 条。`);
  if (!apply) {
    for (const d of targets.slice(0, 10)) console.log(`  · ${d.data().title}`);
    if (targets.length > 10) console.log(`  …（还有 ${targets.length - 10} 条）`);
    console.log(`\n这是 dry-run，没有调用 LLM、没有写库。`);
    console.log(`真跑：node scripts/bid-scraper/backfill.js --apply --limit ${DEFAULT_LIMIT}`);
    return;
  }

  const batch = targets.slice(0, limit);
  console.log(`本次回填 ${batch.length} 条（上限 ${limit}）。`);
  let filled = 0;
  let notBid = 0;
  let failed = 0;

  for (const d of batch) {
    const bid = d.data();
    try {
      const summary = await translateWithRetry(bid);
      if (summary.replace(/\s/g, '').toUpperCase().includes('NOT_A_BID')) {
        // 不删除：删了下次抓取还会再进来。打标记，回填和夜间流程都跳过它。
        await d.ref.update({ summary_skipped: 'NOT_A_BID' });
        notBid++;
        console.log(`  - 非招标公告，已标记：${bid.title}`);
        continue;
      }
      await d.ref.update({ summary_zh: summary, backfilled_at: new Date() });
      filled++;
      console.log(`  + ${bid.title}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ 失败（保持原样，下次可再跑）：${bid.title} — ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  const remaining = targets.length - batch.length;
  console.log(`\n完成：回填 ${filled}，标记非招标 ${notBid}，失败 ${failed}，剩余 ${remaining}。`);
  console.log(formatUsage(usageAcc));
  if (remaining > 0) console.log(`剩余的再跑一次即可（每次最多 ${limit} 条）。`);
}

module.exports = { needsBackfill, parseArgs, DEFAULT_LIMIT };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
