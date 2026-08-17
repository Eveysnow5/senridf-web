const axios = require('axios');
const { createHash } = require('crypto');
const admin = require('firebase-admin');
const { loadModelConfig } = require('../_lib/model-config');
const { isTransientCallError, retryDelayMs } = require('../_lib/llm-retry');
const { emptyUsage, addUsage, formatUsage } = require('../_lib/llm-usage');
const SOURCES = require('./sources');
const { parseFeed, parseListLinks } = require('./parse');
const { isoWeek } = require('./week');
const { buildJudgmentPrompt, parseJudgment } = require('./relevance');
const { shouldRejudge, attemptsOf } = require('./rejudge');
const { buildDigestPrompt, validateDigestCitations } = require('./digest');

// 政府反爬（如 meti.go.jp）对无 UA / "compatible; XxxScraper" 形式的 UA 返回 403，
// 必须用完整桌面浏览器 UA 才稳。
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// 每源单轮最多判定的条目数：PR TIMES/ITmedia 等是全行业消防栓 feed，
// 大多数条目会被 filtered_out。周频 + qwen-plus 计费下，加上限护成本（尤其首轮空去重时）。
const MAX_ITEMS_PER_SOURCE = 40;

// 单条判定在**同一轮内**最多试几次。跨轮的上限另有其数（见 rejudge.js）。
const JUDGE_ATTEMPTS_PER_RUN = 2;
const JUDGE_TIMEOUT_MS = 30000;
// 重试用更长的超时：观测到的失败全部是"卡在 30 秒"，用同样的超时再试一次很可能同样卡死。
// ⚠️ 45s 是暂定值——本轮同时接入了 usage 统计，等拿到真实的每次调用耗时/推理 token
// 再决定该调这个数还是该关掉思考模式。别把它当成量出来的结论。
const JUDGE_RETRY_TIMEOUT_MS = 45000;

// 本进程累计的 token 用量。两个爬虫共用一个免费桶，所以这个数字要能直接相加。
const usageAcc = emptyUsage();

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
  const { CHAT_ENDPOINT, modelFor } = await loadModelConfig();
  const res = await axios.post(
    CHAT_ENDPOINT,
    {
      model: modelFor('aiIntel', process.env),
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
  addUsage(usageAcc, res.data?.usage);
  return res.data.choices?.[0]?.message?.content?.trim() || '';
}

// 判定一条候选。瞬时故障（超时/限流/5xx/网络抖动）在轮内重试；
// 拿不到判定才回落成 llm_error —— 而 llm_error 现在是**可跨轮重判**的，不再是死刑。
async function judgeWithRetry(item) {
  let lastErr;
  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS_PER_RUN; attempt++) {
    try {
      const timeout = attempt === 1 ? JUDGE_TIMEOUT_MS : JUDGE_RETRY_TIMEOUT_MS;
      return parseJudgment(await qwen(buildJudgmentPrompt(item), 500, timeout));
    } catch (err) {
      lastErr = err;
      if (attempt === JUDGE_ATTEMPTS_PER_RUN || !isTransientCallError(err)) break;
      console.error(`  Judge attempt ${attempt} failed (${err.message}), retrying…`);
      await sleep(retryDelayMs(attempt));
    }
  }
  console.error(`  Judge failed for "${item.title}": ${lastErr.message}`);
  return { keep: false, reason: 'llm_error' };
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
    bad_json: 0,
    llm_error: 0,
    failed_fetch: 0,
    rejudged: 0, // 旁路库里"没拿到判断"的条目被重新判定的次数
    recovered: 0, // 其中重判后真正入库的（即上一轮被误丢的情报）
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
      // stat.found 保留真实解析总数；实际只处理前 MAX_ITEMS_PER_SOURCE 条护成本。
      const toProcess = items.slice(0, MAX_ITEMS_PER_SOURCE);
      console.log(`  ${items.length} items parsed (processing ${toProcess.length})`);

      for (const item of toProcess) {
        const hash = urlHash(item.url);

        // 去重：主库已有即跳过。
        const dupMain = await col.where('url_hash', '==', hash).limit(1).get();
        if (!dupMain.empty) {
          totals.skipped_dup++;
          continue;
        }
        // 旁路库已有：模型做过判断（filtered_out）才是结论，跳过；
        // 「没拿到判断」的（超时/坏 JSON/额度耗尽）要重判，到次数上限才转永久。
        const dupRej = await rejectedCol.where('url_hash', '==', hash).limit(1).get();
        let rejectedRef = null;
        let priorAttempts = 0;
        if (!dupRej.empty) {
          const doc = dupRej.docs[0];
          const prior = doc.data();
          if (!shouldRejudge(prior)) {
            totals.skipped_dup++;
            continue;
          }
          rejectedRef = doc.ref;
          priorAttempts = attemptsOf(prior);
          totals.rejudged++;
          console.log(
            `  ↻ rejudge (第 ${priorAttempts + 1} 次，前次 ${prior.reason}): ${item.title}`,
          );
        }

        const verdict = await judgeWithRetry(item);

        if (!verdict.keep) {
          const reason = verdict.reason || 'filtered_out';
          if (reason === 'llm_error') totals.llm_error++;
          else if (reason === 'bad_json') totals.bad_json++;
          else totals.filtered_out++;
          const record = {
            url_hash: hash,
            title: item.title || '',
            url: item.url,
            source: src.name,
            reason,
            attempts: priorAttempts + 1,
            raw_snippet: (item.raw || item.title || '').slice(0, 500),
            fetched_at: admin.firestore.FieldValue.serverTimestamp(),
            week,
            expireAt: sixMonthsFromNow(),
          };
          // 重判失败就更新原条目，不另开一条——否则旁路库里会为同一 URL 堆出多条，
          // 而去重只取 limit(1)，attempts 计数会失真、上限永远到不了顶。
          if (rejectedRef) await rejectedRef.set(record, { merge: true });
          else await rejectedCol.add(record);
          console.log(`  - reject (${reason}, 第 ${record.attempts} 次): ${item.title}`);
          await sleep(400);
          continue;
        }

        // 重判成功：条目要进主库，旁路库里那条同 URL 的记录必须删掉，
        // 否则它会一直躺在那儿，让人以为这条被拒过。
        if (rejectedRef) {
          await rejectedRef.delete();
          totals.recovered++;
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
    // weekItems 只作"本轮有无新增"的触发信号；简报按本周全量入库条目构建，
    // 这样同周多次运行（如重试）不会用更少条目覆盖掉更全的简报，且幂等。
    let digestOk = false;
    if (weekItems.length > 0) {
      try {
        const weekSnap = await col.where('week', '==', week).get();
        const digestItems = weekSnap.docs.map((d) => {
          const x = d.data();
          return { title: x.title, summary_zh: x.summary_zh, theme: x.theme, url: x.url };
        });
        const body = await qwen(buildDigestPrompt(digestItems, week), 2000, 60000);
        if (!body) throw new Error('empty digest response');
        const { ok, unknownUrls } = validateDigestCitations(body, digestItems);
        await db
          .collection('ai_intel_digest')
          .doc(week)
          .set({
            week,
            generated_at: admin.firestore.FieldValue.serverTimestamp(),
            body_md: body,
            item_count: digestItems.length,
            source_urls: digestItems.map((i) => i.url),
            citation_ok: ok,
            unknown_urls: unknownUrls,
          });
        digestOk = ok;
        console.log(`Digest written for ${week} (${digestItems.length} items, citation_ok=${ok})`);
      } catch (err) {
        console.error(`Digest failed: ${err.message}`);
      }
    }

    console.log(
      `\nDone. +${totals.inserted} ingested, ${totals.filtered_out} filtered, ` +
        `${totals.llm_error} llm-errors, ${totals.rejudged} rejudged (${totals.recovered} recovered).`,
    );
    console.log(formatUsage(usageAcc));
    await writeRunReport(db, {
      ok: true,
      week,
      digest_ok: digestOk,
      duration_ms: Date.now() - startedAt,
      totals,
      usage: usageAcc,
      sources,
    });
  } catch (err) {
    // 崩掉的那轮更需要知道烧了多少——额度见底正是这条路径的典型成因。
    console.log(formatUsage(usageAcc));
    await writeRunReport(db, {
      ok: false,
      error: err.message,
      week,
      duration_ms: Date.now() - startedAt,
      totals,
      usage: usageAcc,
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
