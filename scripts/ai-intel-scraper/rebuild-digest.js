// 按周重建情报简报。
//
// 为什么需要它：主流程只在「本轮有新增」时才生成简报，而且只生成**当前那一周**的。
// 于是 2026-08 出现了一个洞：W32~W34 三周各因不同原因没生成简报
// （103 次 403 / 简报 60 秒超时 / 49 次 403），条目却大多已经入库了 ——
// **素材在，摘要没有**，而下周跑的是下周的，洞不会自己长回来。
//
// 这个脚本把「生成某一周的简报」从主流程里解耦出来：给定周次，从 ai_intel 里
// 取那一周的全部条目重建。幂等 —— 同一周重复跑只会覆盖成更全的版本。
//
// 用法（本地或 GitHub Actions）：
//   node rebuild-digest.js --week 2026-W34            # 预览，不写库
//   node rebuild-digest.js --week 2026-W34 --apply    # 真的写进 Firestore
//   node rebuild-digest.js --weeks 2026-W33,2026-W34 --apply
//
// ⚠️ 默认 **dry-run**。会烧额度的操作，危险的那一侧不能是默认
//    （招标回填那边定下的规矩，这里沿用）。

const { isoWeek } = require('./week');
const { buildDigestPrompt, validateDigestCitations } = require('./digest');
const { emptyUsage, addUsage, formatUsage } = require('../_lib/llm-usage');
const { describeCallError } = require('../_lib/llm-retry');

const DIGEST_TIMEOUT_MS = 120000; // 主流程用 60s 曾经超时；重建不赶时间，给足
const WEEK_RE = /^\d{4}-W\d{2}$/;

/**
 * 解析命令行参数。纯函数，可单测。
 * @returns {{weeks: string[], apply: boolean, error?: string}}
 */
function parseArgs(argv) {
  const out = { weeks: [], apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--week' || a === '--weeks') {
      const v = argv[++i];
      if (!v) return { ...out, error: `${a} 后面要跟周次，如 2026-W34` };
      out.weeks.push(
        ...v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  if (!out.weeks.length) return { ...out, error: '必须指定 --week，如 --week 2026-W34' };
  const bad = out.weeks.filter((w) => !WEEK_RE.test(w));
  if (bad.length) return { ...out, error: `周次格式应为 YYYY-Www：${bad.join(', ')}` };
  return out;
}

/**
 * 一周该不该重建、以及重建前要不要拦一下。纯函数，可单测。
 *
 * 三种情况分开，因为它们的处理方式完全不同：
 *   - 没有条目           → 重建也没素材，跳过（W32 就是这样：那周 103 条全判定失败）
 *   - 已有简报且条目数没变 → 白烧额度，跳过
 *   - 其余               → 重建
 */
function planWeek({ week, itemCount, existing }) {
  if (!itemCount) {
    return {
      action: 'skip',
      why: `${week}：库里一条都没有 —— 那一周的条目当初就没入库，重建无米下锅`,
    };
  }
  if (existing && existing.item_count === itemCount && existing.citation_ok) {
    return {
      action: 'skip',
      why: `${week}：已有简报且条目数一致（${itemCount} 条），不重复烧额度`,
    };
  }
  if (existing) {
    return {
      action: 'rebuild',
      why: `${week}：已有简报但素材变了（${existing.item_count} → ${itemCount} 条）或引用校验没过，重建`,
    };
  }
  return { action: 'rebuild', why: `${week}：缺简报，${itemCount} 条素材可用` };
}

module.exports = { parseArgs, planWeek, WEEK_RE, DIGEST_TIMEOUT_MS };

// ── 以下是需要网络/凭据的部分，只在直接执行时加载 ──────────────────────────
// 重依赖放模块顶层会让仓库根跑 node --test 时炸（firebase-admin 只装在本目录）。
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function main() {
  const axios = require('axios');
  const admin = require('firebase-admin');
  const { loadModelConfig } = require('../_lib/model-config');

  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    console.error('用法：node rebuild-digest.js --week 2026-W34 [--apply]');
    process.exit(1);
  }

  console.log(`目标周次：${args.weeks.join(', ')}`);
  console.log(args.apply ? '模式：**真的写库**' : '模式：dry-run（不写库，加 --apply 才写）');
  console.log(`当前周次：${isoWeek(new Date())}\n`);

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  const db = admin.firestore();
  const { CHAT_ENDPOINT, modelFor } = await loadModelConfig();
  const usage = emptyUsage();

  let rebuilt = 0;
  let skipped = 0;
  let failed = 0;

  for (const week of args.weeks) {
    const snap = await db.collection('ai_intel').where('week', '==', week).get();
    const items = snap.docs.map((d) => {
      const x = d.data();
      return { title: x.title, summary_zh: x.summary_zh, theme: x.theme, url: x.url };
    });
    const existingDoc = await db.collection('ai_intel_digest').doc(week).get();
    const plan = planWeek({
      week,
      itemCount: items.length,
      existing: existingDoc.exists ? existingDoc.data() : null,
    });
    console.log(plan.why);
    if (plan.action === 'skip') {
      skipped++;
      continue;
    }
    if (!args.apply) {
      console.log(`  （dry-run）将用 ${items.length} 条素材重建 ${week}\n`);
      continue;
    }

    try {
      const res = await axios.post(
        CHAT_ENDPOINT,
        {
          model: modelFor('aiIntel', process.env),
          messages: [{ role: 'user', content: buildDigestPrompt(items, week) }],
          max_tokens: 2000,
          // 见 index.js 里同一段说明：推理内容会被丢弃，开着只是慢和费钱。
          enable_thinking: false,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: DIGEST_TIMEOUT_MS,
        },
      );
      addUsage(usage, res.data?.usage);
      const body = res.data.choices?.[0]?.message?.content?.trim() || '';
      if (!body) throw new Error('模型返回空简报');
      const { ok, unknownUrls } = validateDigestCitations(body, items);

      await db
        .collection('ai_intel_digest')
        .doc(week)
        .set({
          week,
          generated_at: admin.firestore.FieldValue.serverTimestamp(),
          // 留痕：这一份是补建的，不是当周自动生成的。看历史时这点很重要。
          rebuilt_at: admin.firestore.FieldValue.serverTimestamp(),
          body_md: body,
          item_count: items.length,
          source_urls: items.map((i) => i.url),
          citation_ok: ok,
          unknown_urls: unknownUrls,
        });
      console.log(`  ✓ ${week} 已重建（${items.length} 条，引用校验 ${ok ? '通过' : '未通过'}）\n`);
      rebuilt++;
    } catch (err) {
      console.error(`  ✗ ${week} 重建失败：${describeCallError(err)}\n`);
      failed++;
    }
  }

  console.log(`完成：重建 ${rebuilt}，跳过 ${skipped}，失败 ${failed}`);
  console.log(formatUsage(usage));
  if (failed > 0) process.exit(1);
}
