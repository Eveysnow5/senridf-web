const axios = require('axios');
const cheerio = require('cheerio');
const { createHash } = require('crypto');
const admin = require('firebase-admin');
const { loadModelConfig } = require('../_lib/model-config');
const { isTransientCallError, retryDelayMs, describeCallError } = require('../_lib/llm-retry');
const { emptyUsage, addUsage, formatUsage } = require('../_lib/llm-usage');
const {
  isClosed,
  detectToyonakaCategory,
  parseOsakaBids,
  parseSuitaBids,
  parseToyonakaLinks,
} = require('./parse');

// NOTE: Suita City URLs are year-specific (令和8年度 = 2026).
// Update these each April when a new fiscal year begins.
const TARGETS = [
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

function initFirebase() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

function urlHash(url) {
  return createHash('md5').update(url).digest('hex');
}

// 单条摘要在同一轮内最多试几次（瞬时故障才重试，见 _lib/llm-retry.js）。
const TRANSLATE_ATTEMPTS_PER_RUN = 2;

// 本进程累计的 token 用量。与情报爬虫共用一个免费桶，两边数字可直接相加。
const usageAcc = emptyUsage();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchToyonakaDetail(title, sourceUrl, target) {
  let html;
  try {
    const res = await axios.get(sourceUrl, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BidScraper/1.0)' },
    });
    html = res.data;
  } catch (err) {
    console.error(`  Failed to fetch ${sourceUrl}: ${err.message}`);
    return null;
  }

  const $ = cheerio.load(html);
  let bureau = '';
  let deadline = '';
  let announced = '';

  $('tr').each((_, row) => {
    const th = $(row).find('th').text().trim();
    const td = $(row).find('td').text().trim();
    if (!deadline && /入札書提出|提出期間|締切|受付期間|募集期間/.test(th)) deadline = td;
    if (!announced && /公告日|公開日|告示日/.test(th)) announced = td;
  });

  if (!announced) {
    $('p, div').each((_, el) => {
      if (announced) return;
      const m = $(el)
        .text()
        .match(/更新日[：:]\s*(\d{4}年\d+月\d+日)/);
      if (m) announced = m[1];
    });
  }

  $('p, td, li').each((_, el) => {
    if (bureau) return;
    const text = $(el).text().trim();
    if (text.length < 25 && /(部|課|室|局)$/.test(text)) bureau = text;
  });

  // Detect "this solicitation has ended" notices on the detail page.
  const bodyText = $('body').text() || '';
  const ended =
    /この案件は募集を終了|募集を終了しています|受付を終了|受付は終了|終了しました/.test(bodyText) ||
    /終了しました/.test(title);

  const { category, categoryLabel } = detectToyonakaCategory(title);

  return {
    title,
    source_url: sourceUrl,
    city: target.city,
    category,
    category_label: categoryLabel,
    announcement_date: announced,
    deadline,
    ordering_bureau: bureau,
    budget: '',
    ended,
  };
}

// ── Qwen translation ────────────────────────────────────────────────────────
async function translate(bid) {
  const prompt = `你是一名专业的日中双语翻译助手。请将以下日本${bid.city}政府招标信息翻译并整理为简体中文。

招标标题：${bid.title}
发注单位：${bid.ordering_bureau || '未知'}
截止日期：${bid.deadline || '未知'}
类别：${bid.category_label}

【判断】如果以上内容根本不是一条招标公告（例如是网站导航页、版权说明、站点地图、组织介绍、市役所设施介绍等），请只输出 NOT_A_BID 这一个词，不要输出任何其它内容。

如果确实是招标公告，请严格用简体中文输出，禁止出现任何日语假名或汉字日语词汇。按以下格式输出：
【内容】用1～2句中文简述招标内容
【发注元】发注单位的中文译名
【截标】截止日期（用中文表达，如"2026年3月12日（星期三）下午2时"；若信息中确无截止日期则写"信息未提供"）`;

  const { CHAT_ENDPOINT, modelFor } = await loadModelConfig();
  const res = await axios.post(
    CHAT_ENDPOINT,
    {
      model: modelFor('bidSummary', process.env),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      // Qwen3 在 DashScope 上默认开混合思考。本调用只读 message.content，
      // 推理内容被直接丢弃——花钱买了扔掉，还慢好几倍。
      // 2026-08-25：六个 Pages Functions 端点关掉了，但**爬虫和 Worker 漏了**，
      // 于是情报简报仍然 60 秒超时（那一轮判定只剩 1 次报错，唯独简报没生成）。
      // 当天写的护栏只扫了 functions/api/ —— 护栏本身也只覆盖了作者当时想到的范围。
      enable_thinking: false,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    },
  );

  addUsage(usageAcc, res.data?.usage);
  return res.data.choices?.[0]?.message?.content?.trim() || '';
}

// 摘要失败会让条目带着空摘要永久入库（去重后再也不会重译），所以瞬时故障要在轮内重试。
async function translateWithRetry(bid) {
  let lastErr;
  for (let attempt = 1; attempt <= TRANSLATE_ATTEMPTS_PER_RUN; attempt++) {
    try {
      return await translate(bid);
    } catch (err) {
      lastErr = err;
      if (attempt === TRANSLATE_ATTEMPTS_PER_RUN || !isTransientCallError(err)) break;
      console.error(`  Translate attempt ${attempt} failed (${describeCallError(err)}), retrying…`);
      await sleep(retryDelayMs(attempt));
    }
  }
  throw lastErr;
}

// ── Run report ──────────────────────────────────────────────────────────────
async function writeRunReport(db, report) {
  try {
    await db
      .collection('meta')
      .doc('scrape_status')
      .set({
        ...report,
        finished_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    console.log('Run report written to meta/scrape_status');
  } catch (e) {
    console.error('Failed to write run report:', e.message);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const db = initFirebase();
  const bidsCol = db.collection('bids');

  const totals = {
    found: 0,
    inserted: 0,
    skipped_dup: 0,
    skipped_notbid: 0,
    closed: 0,
    failed_fetch: 0,
    translate_failed: 0,
  };
  const sources = [];

  try {
    for (const target of TARGETS) {
      const srcStat = {
        city: target.city,
        category: target.categoryLabel || '混合',
        found: 0,
        inserted: 0,
        closed: 0,
        error: '',
      };
      console.log(`\n[${target.city}] ${target.url}`);

      let html;
      try {
        const res = await axios.get(target.url, {
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BidScraper/1.0)' },
        });
        html = res.data;
      } catch (err) {
        console.error(`  Fetch failed: ${err.message}`);
        srcStat.error = `列表抓取失败: ${err.message}`;
        totals.failed_fetch++;
        sources.push(srcStat);
        continue;
      }

      let bids = [];

      if (target.type === 'osaka') {
        bids = parseOsakaBids(html, target);
        console.log(`  ${bids.length} bids parsed`);
      } else if (target.type === 'suita') {
        bids = parseSuitaBids(html, target);
        console.log(`  ${bids.length} active bids parsed`);
      } else if (target.type === 'toyonaka') {
        const links = parseToyonakaLinks(html, target);
        console.log(`  ${links.length} bid links found, fetching details...`);
        for (const link of links) {
          const bid = await fetchToyonakaDetail(link.title, link.source_url, target);
          if (bid) bids.push(bid);
          await sleep(400);
        }
        console.log(`  ${bids.length} bids parsed`);
      }

      srcStat.found = bids.length;
      totals.found += bids.length;

      for (const bid of bids) {
        const closed = isClosed(bid);
        bid.status = closed ? 'closed' : 'open';
        if (closed) {
          srcStat.closed++;
          totals.closed++;
        }

        const hash = urlHash(bid.source_url);
        const existing = await bidsCol.where('url_hash', '==', hash).limit(1).get();
        if (!existing.empty) {
          totals.skipped_dup++;
          continue;
        }

        let summary = '';
        try {
          summary = await translateWithRetry(bid);
        } catch (err) {
          console.error(`  Translation failed for "${bid.title}": ${describeCallError(err)}`);
          totals.translate_failed++;
        }

        // Drop non-bid pages flagged by the model.
        if (summary.replace(/\s/g, '').toUpperCase().includes('NOT_A_BID')) {
          console.log(`  - skip (not a bid): ${bid.title}`);
          totals.skipped_notbid++;
          continue;
        }

        const { ended, ...rest } = bid;
        await bidsCol.add({
          ...rest,
          url_hash: hash,
          summary_zh: summary,
          status: bid.status,
          scraped_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`  + ${bid.title}${closed ? ' (closed)' : ''}`);
        srcStat.inserted++;
        totals.inserted++;
        await sleep(600);
      }

      sources.push(srcStat);
    }

    console.log(`\nDone. ${totals.inserted} new bids added.`);
    console.log(formatUsage(usageAcc));
    await writeRunReport(db, {
      ok: true,
      duration_ms: Date.now() - startedAt,
      totals,
      usage: usageAcc,
      sources,
    });
  } catch (err) {
    console.log(formatUsage(usageAcc));
    await writeRunReport(db, {
      ok: false,
      error: err.message,
      duration_ms: Date.now() - startedAt,
      totals,
      usage: usageAcc,
      sources,
    });
    throw err;
  }
}

// 导出给回填脚本复用。**必须复用同一个 translate**：回填若自带一份提示词，
// 产出的摘要格式会跟夜间流程慢慢分叉，而这种不一致没有任何报错。
module.exports = { translate, translateWithRetry, usageAcc };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
