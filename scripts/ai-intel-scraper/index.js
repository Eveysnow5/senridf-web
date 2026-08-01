const axios = require('axios');
const { createHash } = require('crypto');
const admin = require('firebase-admin');
const SOURCES = require('./sources');
const { parseFeed, parseListLinks } = require('./parse');
const { isoWeek } = require('./week');
const { buildJudgmentPrompt, parseJudgment } = require('./relevance');
const { buildDigestPrompt, validateDigestCitations } = require('./digest');

// 政府反爬（如 meti.go.jp）对无 UA / "compatible; XxxScraper" 形式的 UA 返回 403，
// 必须用完整桌面浏览器 UA 才稳。
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function initFirebase() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

function urlHash(url) {
  return createHash('md5').update(url).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sixMonthsFromNow() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d;
}

async function fetchSource(src) {
  const res = await axios.get(src.url, {
    timeout: 30000,
    headers: { 'User-Agent': USER_AGENT },
  });
  return res.data;
}

// ── Qwen 调用 ────────────────────────────────────────────────────────────────
async function qwen(prompt, maxTokens, timeout) {
  const res = await axios.post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      model: 'qwen-plus',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout,
    },
  );
  return res.data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Run report ──────────────────────────────────────────────────────────────
async function writeRunReport(db, report) {
  try {
    await db
      .collection('meta')
      .doc('ai_intel_status')
      .set({
        ...report,
        finished_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    console.log('Run report written to meta/ai_intel_status');
  } catch (e) {
    console.error('Failed to write run report:', e.message);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const db = initFirebase();
  const col = db.collection('ai_intel');
  const rejectedCol = db.collection('ai_intel_rejected');
  const week = isoWeek(new Date());

  const totals = {
    found: 0,
    inserted: 0,
    skipped_dup: 0,
    filtered_out: 0,
    llm_error: 0,
    failed_fetch: 0,
  };
  const sources = [];
  const weekItems = [];

  try {
    for (const src of SOURCES) {
      const stat = { name: src.name, found: 0, inserted: 0, error: '' };
      console.log(`\n[${src.name}] ${src.url}`);

      let raw;
      try {
        raw = await fetchSource(src);
      } catch (err) {
        console.error(`  Fetch failed: ${err.message}`);
        stat.error = `抓取失败: ${err.message}`;
        totals.failed_fetch++;
        sources.push(stat);
        continue;
      }

      let items = [];
      try {
        items =
          src.type === 'rss'
            ? parseFeed(raw)
            : parseListLinks(raw, { linkSelector: src.linkSelector, base: src.base });
      } catch (err) {
        console.error(`  Parse failed: ${err.message}`);
        stat.error = `解析失败: ${err.message}`;
        totals.failed_fetch++;
        sources.push(stat);
        continue;
      }
      stat.found = items.length;
      totals.found += items.length;
      console.log(`  ${items.length} items parsed`);

      for (const item of items) {
        const hash = urlHash(item.url);

        // 去重：主库或旁路库里已有即跳过（失败条目也不每周重判）。
        const dupMain = await col.where('url_hash', '==', hash).limit(1).get();
        if (!dupMain.empty) {
          totals.skipped_dup++;
          continue;
        }
        const dupRej = await rejectedCol.where('url_hash', '==', hash).limit(1).get();
        if (!dupRej.empty) {
          totals.skipped_dup++;
          continue;
        }

        let verdict;
        try {
          const rawJudgment = await qwen(buildJudgmentPrompt(item), 500, 30000);
          verdict = parseJudgment(rawJudgment);
        } catch (err) {
          console.error(`  Judge failed for "${item.title}": ${err.message}`);
          verdict = { keep: false, reason: 'llm_error' };
        }

        if (!verdict.keep) {
          const reason = verdict.reason || 'filtered_out';
          if (reason === 'llm_error') totals.llm_error++;
          else totals.filtered_out++;
          await rejectedCol.add({
            url_hash: hash,
            title: item.title || '',
            url: item.url,
            source: src.name,
            reason,
            raw_snippet: (item.raw || item.title || '').slice(0, 500),
            fetched_at: admin.firestore.FieldValue.serverTimestamp(),
            week,
            expireAt: sixMonthsFromNow(),
          });
          console.log(`  - reject (${reason}): ${item.title}`);
          await sleep(400);
          continue;
        }

        await col.add({
          url_hash: hash,
          title: item.title,
          summary_zh: verdict.summary_zh,
          theme: verdict.theme,
          source: src.name,
          url: item.url,
          published_at: item.published_at || null,
          fetched_at: admin.firestore.FieldValue.serverTimestamp(),
          week,
          key_facts: verdict.key_facts,
        });
        weekItems.push({
          title: item.title,
          summary_zh: verdict.summary_zh,
          theme: verdict.theme,
          url: item.url,
        });
        console.log(`  + [${verdict.theme}] ${item.title}`);
        stat.inserted++;
        totals.inserted++;
        await sleep(600);
      }

      sources.push(stat);
    }

    // ── 每周简报：失败不得中断整轮 ──
    let digestOk = false;
    if (weekItems.length > 0) {
      try {
        const body = await qwen(buildDigestPrompt(weekItems, week), 2000, 60000);
        const { ok, unknownUrls } = validateDigestCitations(body, weekItems);
        await db
          .collection('ai_intel_digest')
          .doc(week)
          .set({
            week,
            generated_at: admin.firestore.FieldValue.serverTimestamp(),
            body_md: body,
            item_count: weekItems.length,
            source_urls: weekItems.map((i) => i.url),
            citation_ok: ok,
            unknown_urls: unknownUrls,
          });
        digestOk = ok;
        console.log(`Digest written for ${week} (citation_ok=${ok})`);
      } catch (err) {
        console.error(`Digest failed: ${err.message}`);
      }
    }

    console.log(
      `\nDone. +${totals.inserted} ingested, ${totals.filtered_out} filtered, ${totals.llm_error} llm-errors.`,
    );
    await writeRunReport(db, {
      ok: true,
      week,
      digest_ok: digestOk,
      duration_ms: Date.now() - startedAt,
      totals,
      sources,
    });
  } catch (err) {
    await writeRunReport(db, {
      ok: false,
      error: err.message,
      week,
      duration_ms: Date.now() - startedAt,
      totals,
      sources,
    });
    throw err;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
