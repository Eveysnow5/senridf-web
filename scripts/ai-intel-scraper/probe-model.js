// 用一次真实调用探一个模型：能不能用、多快、推理 token 占多少、
// 接不接受 enable_thinking:false。
//
// ── 为什么要有这个 ──────────────────────────────────────────────────────────
// 2026-08-25 这一天，「换模型 / 加参数」这件事失败了四次，每次的代价都是
// 一整轮 push → 镜像 → 部署 → 作者手动点一次 → 读日志：
//   1. strong 换成 2.4t-a95b     → 交互端点 502（模型太慢）
//   2. 怀疑浏览器扩展            → 排除，白花一轮
//   3. 关思考只改了 functions/api → 爬虫仍然 60 秒超时
//   4. 给 a95b 传 enable_thinking → HTTP 400，这个模型根本不允许关
// 四次里有三次，**一次真实调用就能提前判掉**。
//
// 根本问题不是判断力，是**没有一条便宜的验证路径**：所有假设都只能走生产链路，
// 于是每个假设都要花掉作者一次点击。这个脚本就是那条便宜的路径。
//
// ── 第二个用途：定时哨兵（2026-09-04 加）────────────────────────────────────
// 上面说的是"换模型时先探一下"。加上 `--from-tiers` 之后它还兼一件事：
// **每周替我们盯着额度悬崖**（`.github/workflows/probe-model.yml` 的 schedule）。
//
// 为什么需要：2026-08-24 qwen3.8-max 的免费桶用尽，全站八个功能同时 403，
// 而 **GitHub Actions 连报四周 success**（简报失败被设计成"不中断整轮"），
// 403 的响应体也没被记录。最后是作者发现 AI 情报页停在 W31 才知道的。
//
// 哨兵查两件独立的事，缺一不可：
//   ① 模型还能不能答（退役、参数被拒、限流）—— 一次真实调用
//   ② 免费额度还剩几天（`TIER_EXPIRY`）—— **桶空了模型照样存在，①永远是绿的**
//
// ⚠️ 它**证明不了线上没事**。这里用的是仓库的 `QWEN_API_KEY`，而 Pages Functions
// 读的是同事 Cloudflare 项目里的那一份，我们改不了也看不到。两者是不是同一个账号
// 没有核实过。绿灯的意思是"我们这份 key 打得通这个模型"，不是"senridf.com 正常"。
//
// 用法：
//   node probe-model.js --model qwen3.8-27b
//   node probe-model.js --model qwen3.8-27b --no-thinking-off   # 不传那个参数
//   node probe-model.js --model a --model b                     # 一次比几个
//   node probe-model.js --from-tiers                            # 探 TIERS 里的全部 + 查到期

const PROMPT = '用一句话说明：为什么冗余的备份策略比单一备份更可靠？';
const TIMEOUT_MS = 90000;
// 到期前多少天开始报警。三周：够走完"翻控制台找替代模型 → 验参数 → 改 TIERS →
// push → 镜像 → 同事那边部署"这条链，而这条链上有一段不由我们控制。
const EXPIRY_WARN_DAYS = 21;

/** 解析参数。纯函数，可单测。 */
function parseArgs(argv) {
  const out = { models: [], thinkingOff: true, fromTiers: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model') {
      const v = argv[++i];
      if (!v) return { ...out, error: '--model 后面要跟模型名' };
      out.models.push(v);
    } else if (argv[i] === '--no-thinking-off') {
      out.thinkingOff = false;
    } else if (argv[i] === '--from-tiers') {
      // ⚠️ 模型名**不写进 workflow**。写进去的话，改 TIERS 时哨兵还在探老模型 ——
      // 它会一直绿着，而绿的是一个已经没人用的模型。
      out.fromTiers = true;
    }
  }
  if (!out.models.length && !out.fromTiers) {
    return { ...out, error: '必须指定至少一个 --model，或用 --from-tiers' };
  }
  return out;
}

/**
 * 免费额度到期检查。纯函数，可单测。
 *
 * ⚠️ 这查的是**日历**，不是余量。桶被提前用尽它不会知道（没有接口可以问）。
 * 它防的是另一件事：**日期只写在注释里，没有人会去读**。
 */
function expiryVerdict(model, dateStr, now = new Date(), warnDays = EXPIRY_WARN_DAYS) {
  if (!dateStr) {
    // 缺一条比记错一条更危险：TIERS 换了模型却忘了登记到期日，
    // 哨兵会安安静静地不报警。所以缺失本身就要报。
    return { kind: 'unknown', days: null, note: `${model} 没有登记到期日（TIER_EXPIRY 里缺）` };
  }
  const end = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(end)) {
    return { kind: 'unknown', days: null, note: `${model} 的到期日 ${dateStr} 解析不了` };
  }
  const days = Math.floor((end - now.getTime()) / 86400000);
  if (days < 0) return { kind: 'expired', days, note: `${model} 的免费额度已于 ${dateStr} 到期` };
  if (days <= warnDays) {
    return { kind: 'soon', days, note: `${model} 的免费额度 ${dateStr} 到期，只剩 ${days} 天` };
  }
  return { kind: 'ok', days, note: `${model} 到期 ${dateStr}（还有 ${days} 天）` };
}

/**
 * 把一次探测结果读成结论。纯函数，可单测。
 *
 * 三种结局要分开，因为它们指向完全不同的处理：
 *   - rejects_flag  模型不允许关思考（a95b 就是），这个项目里不能用
 *   - thinking_on   接受了参数但仍在产推理，说明参数没起作用
 *   - ok            可用
 */
function verdict({ status, providerMessage, usage, thinkingOff }) {
  if (status === 400 && /enable_thinking/i.test(providerMessage || '')) {
    return {
      kind: 'rejects_flag',
      note: '该模型不允许关闭思考 —— 推理 token 无法避免，而我们只读 content，纯浪费',
    };
  }
  if (status !== 200) {
    return { kind: 'error', note: `HTTP ${status}：${providerMessage || '(无响应体信息)'}` };
  }
  const out = usage?.completion_tokens || 0;
  const reasoning = usage?.completion_tokens_details?.reasoning_tokens || 0;
  const ratio = out > 0 ? reasoning / out : 0;
  if (thinkingOff && ratio > 0.2) {
    return {
      kind: 'thinking_on',
      note: `传了 enable_thinking:false 但推理仍占 ${(ratio * 100).toFixed(0)}% —— 参数没生效`,
    };
  }
  return { kind: 'ok', note: `推理占比 ${(ratio * 100).toFixed(0)}%` };
}

module.exports = { parseArgs, verdict, expiryVerdict, PROMPT, TIMEOUT_MS, EXPIRY_WARN_DAYS };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function main() {
  const axios = require('axios');
  const { loadModelConfig } = require('../_lib/model-config');
  const { describeCallError } = require('../_lib/llm-retry');

  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    console.error('用法：node probe-model.js --model qwen3.8-27b [--no-thinking-off]');
    process.exit(1);
  }
  const { CHAT_ENDPOINT, TIERS, TIER_EXPIRY } = await loadModelConfig();
  // --from-tiers：模型名从 TIERS 现取，去重。四个档位现在指向两个模型，
  // 不去重就会白探两次。
  const models = args.fromTiers ? [...new Set(Object.values(TIERS))] : args.models;
  if (args.fromTiers) {
    console.log(`档位 ${Object.keys(TIERS).join('/')} → 去重后 ${models.length} 个模型\n`);
  }
  console.log(
    `探测 ${models.length} 个模型，${args.thinkingOff ? '传' : '不传'} enable_thinking:false\n`,
  );

  let bad = 0;
  for (const model of models) {
    const body = { model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 200 };
    if (args.thinkingOff) body.enable_thinking = false;

    const t0 = Date.now();
    let status;
    let providerMessage = '';
    let usage = null;
    try {
      const res = await axios.post(CHAT_ENDPOINT, body, {
        headers: {
          Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_MS,
      });
      status = res.status;
      usage = res.data?.usage;
    } catch (err) {
      status = err.response?.status ?? 0;
      providerMessage = describeCallError(err);
    }
    const ms = Date.now() - t0;
    const v = verdict({ status, providerMessage, usage, thinkingOff: args.thinkingOff });
    const mark = v.kind === 'ok' ? '✓' : '✗';
    console.log(`${mark} ${model}`);
    console.log(`    ${(ms / 1000).toFixed(1)} 秒 · ${v.kind} · ${v.note}`);
    if (usage) {
      console.log(
        `    输入 ${usage.prompt_tokens ?? '?'} / 输出 ${usage.completion_tokens ?? '?'}` +
          `（推理 ${usage.completion_tokens_details?.reasoning_tokens ?? 0}）`,
      );
    }
    console.log('');
    if (v.kind !== 'ok') bad++;
  }

  console.log(bad === 0 ? '全部可用' : `${bad} 个不可用`);

  // ── 额度悬崖 ──────────────────────────────────────────────────────────────
  // ⚠️ 这一段和上面那些调用**互不替代**：模型能答不代表桶里还有量，
  // 桶空了模型照样在，上面永远是绿的。2026-08-24 就是这么静默了四周。
  if (args.fromTiers) {
    console.log('\n免费额度到期检查（查的是日历，不是余量 —— 提前用尽它看不见）：');
    for (const model of models) {
      const e = expiryVerdict(model, TIER_EXPIRY?.[model]);
      const mark = e.kind === 'ok' ? '✓' : '✗';
      console.log(`${mark} ${e.note}`);
      if (e.kind !== 'ok') bad++;
    }
    console.log(
      '\n⚠️ 绿灯只说明"仓库这份 key 打得通这个模型"。Pages Functions 用的是同事' +
        ' Cloudflare 项目里的那份 key，我们看不到，两者是不是同一个账号没核实过。',
    );
  }

  if (bad > 0) process.exit(1);
}
