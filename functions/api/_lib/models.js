// Single source of truth for the LLM provider endpoint and the model each task
// uses. Every /api/* endpoint that calls a chat-completions API reads from here.
//
// WHY THIS FILE EXISTS
// The endpoint URL and model ids used to be hardcoded in 6 endpoints (8 counting
// the two scrapers). Free quota is granted *per model*, so when one model's
// quota runs dry the fix is to point tasks at another model — which meant
// editing 6 files and hoping none was missed. The site is deployed from a
// colleague's Cloudflare account, so we cannot set environment variables
// ourselves; this has to be changeable in code and shipped through the normal
// push → mirror → deploy path.
//
// HOW TO SWITCH MODELS
// Change the three TIERS values below, push, done (~3 min to go live).
// A wrong id is safe to try: the provider replies with an explicit
// "model not found" error that the endpoints already surface to the UI.
//
// HOW TO SWITCH PROVIDER (e.g. 硅基流动 / SiliconFlow — planned)
// Both expose an OpenAI-compatible /v1/chat/completions, so the request and
// response *shapes* need no changes. But this is not a two-string edit — three
// things below were verified on 2026-08-11 and each needs work:
//
//   1. Endpoint: https://api.siliconflow.cn/v1/chat/completions
//   2. Model ids use a VENDOR-PREFIXED namespace, not DashScope's bare names:
//      `Qwen/Qwen2.5-72B-Instruct`, `Pro/deepseek-ai/DeepSeek-R1`. Every TIERS
//      value has to be re-chosen, not just renamed.
//   3. SiliconFlow also streams `delta.reasoning_content`, and its docs
//      document no `enable_thinking` switch. Our two streaming endpoints render
//      `delta.content` only, so a reasoning model there reproduces the 20s
//      "hangs then dumps" bug with no parameter to turn it off — the fix would
//      be to pick a non-reasoning model for `fast` and `balanced`.
//
// KEY OWNERSHIP — the real constraint. The three surfaces read the same var
// name from three different places, and we control only two:
//   · Pages Functions (functions/api/*)  → the COLLEAGUE's Cloudflare Pages
//     project env. We cannot change it; she has to.
//   · workers/sdf-admin                  → our own Worker secret (wrangler)
//   · scripts/*-scraper                  → our repo's GitHub secret (gh)
// Keep the var name `QWEN_API_KEY` even after moving off Qwen: renaming means
// the code change and the secret change must land together, and we do not
// control when the colleague acts — any gap is downtime. An inaccurate name is
// the cheaper problem.
//
// Because CHAT_ENDPOINT is shared, a phased migration is NOT possible as
// written: pointing it at SiliconFlow while the colleague still holds a
// DashScope key would 401 every web tool. Phasing would require per-surface
// endpoint config first.
//
// TIERS, not raw ids: each task declares the *kind* of model it needs, so the
// intent survives both a quota shuffle and a provider swap. TASK_TIER is the
// durable record — `proofread` was deliberately moved to the strongest tier for
// deep semantic proofreading (2026-07-28), and `translateStream` is on a fast
// tier because it runs once per utterance during live interpretation.
//
// NOTE: translation-specialised `qwen-mt-*` models are NOT drop-in here — they
// take `translation_options` instead of a system prompt, which would break the
// glossary injection and the 【原文】/【日本語訳】/【回訳】 output format.

// Provider base. Kept as one exported constant so a provider migration does not
// mean grepping for the URL across every endpoint again.
export const CHAT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// Chosen from the 百炼 free-quota console on 2026-08-10. Two rules drove it:
//   1. Runway. Most buckets in that account expire 2026-08-11, so anything
//      expiring "tomorrow" is worthless no matter how full it is.
//   2. Spread. Every model has its OWN 1M-token bucket, so pointing the tiers
//      at three different models multiplies the usable free tokens instead of
//      draining one pool. Do not collapse these to save a line.
// Remaining quota / expiry as observed:
//   qwen3.8-max              1,000,000  2026-11-01
//   qwen3.7-flash            1,000,000  2026-10-23
//   qwen3.7-plus-2026-05-26  1,000,000  2026-09-01
// Alternates with runway, if one of the above drains:
//   strong    qwen3.7-max-2026-06-08 (09-08) · qwen3.7-max-preview (08-24)
//   balanced  glm-5.2 (09-15) · qwen3.7-plus (944k left, 09-01)
//   fast      deepseek-v4-flash-0731 (10-31)
// Excluded regardless of quota: *-ocr and qwen-vl-* (OCR/vision),
// qwen-math-turbo (maths), kimi-k2-thinking and qwen3-vl-*-thinking (reasoning
// models — latency is unacceptable for live interpretation), kimi-k2.7-code.
// `batch` is for the unattended nightly scrapers. It gets its own model on
// purpose: they run in bulk every night and would otherwise drain the same
// bucket the interactive tools depend on during the day. It stays inside the
// Qwen family rather than moving to deepseek/glm because the bid summaries must
// keep hitting a strict 【内容】【发注元】【截标】 format unattended, and a
// silent format drift there lands straight in the user-facing bids table.
// 2026-08-11 重新分配：balanced 与 batch 原本各占一个桶，但那两个桶分别
// 09-01 / 09-08 到期，而切换供应商要等同事改 Pages 环境变量、不由我们控制，
// 赶在那之前完成的把握不够。于是把悬崖推到 10-23 之后，争取从容期。
//
// 为什么合并而不是换到别的满额度桶：Qwen 家族里到期晚于 09-08 的只剩
// qwen3.8-max(11-01) 和 qwen3.7-flash(10-23)，两个都已在用。其余晚期桶
// （deepseek-v4-flash-0731 10-31、glm-5.2 09-15）都是**跨家族**——作者明确
// 否决了，因为会议纪要要稳定输出【议题】【客户反馈】【行动项】、分析要出
// markdown 报告，跨家族有格式漂移风险，而这类漂移是无人值守时才发作的。
// 爬虫作者判断"量不大，可以凑合"，故一并并入。
//
// ⚠️⚠️ 2026-08-13 更正：上面那个"每月 300~400K"的估算**已经作废**。多轮取页上线后，
// **一天就烧了 451K**（19 次调用，控制台实测），qwen3.8-max 桶从 100% 掉到剩 248K。
// 成本结构变了：单次调用约 23.7K token，其中**页面索引占 21.9K（85%）且每轮重发**。
// 按这个速率，剩余额度只够约 3 次完整多轮分析——**撑不到 11-01，会先被额度打停**
// （「免费额度用完即停」是开着的，所以不会产生费用，但会直接 403 停服）。
//
// ⚠️ 另一条已过期的判断：下面"Excluded regardless of quota: *-ocr and qwen-vl-*"
// 是 2026-08-10 定的，**当时文书分析是纯文本**；08-11 改成页面图像路径之后，
// analyze 这一档**恰恰需要视觉能力**。视觉模型有自己独立的桶（控制台「视觉模型」
// 页签），一个都没用过。换过去之前必须先验证两件事：① 它接不接受 image_url 形式的
// dataURL ② 输出格式会不会漂。qwen3-vl-*-thinking 仍应排除（推理模型延迟不可接受）。
//
// ⚠️ 代价：strong/balanced/batch 现在共用一个 1M 桶。粗估每月 300~400K
// （爬虫约 200K/月 + 交互工具几十 K），到 11-01 约 2.7 个月——**贴着边**。
// 观测点是百炼控制台的「模型用量」；若消耗快于预期，先关掉四个非流式端点
// 的 thinking（推理 token 同样计费却被直接丢弃），那是最便宜的止血。
// ⚠️⚠️ 2026-08-24：qwen3.8-max **已用尽**（控制台「我的试用」显示 0 tokens / 0%）。
// 08-13 那条预言应验了，而且比预期早：三个档位同时指向它，于是翻译、会议纪要、
// 文档分析、校对、人生故事、招标摘要、AI 情报、后台一键同步日英**全部 403**，
// 只有走 fast 的实时口译幸免。
//
// 症状是怎么被发现的，值得记：**不是靠监控，是靠作者发现 AI 情报页停在 W31**。
// GitHub Actions 连续四周报 success（简报失败被设计成"不中断整轮"），
// 而 403 的响应体没被记录，日志里只有 "Request failed with status code 403"。
// 中间三周各死一种（103×403 / 60s 超时 / 49×403），一次都没人知道。
//
// 换成控制台里还满额的两个**同家族**模型。跨家族（kimi-k3、deepseek-v4-*）
// 额度也满，但上面那条否决仍然成立：招标摘要要稳定输出【内容】【发注元】【截标】、
// 会议纪要要输出【议题】【客户反馈】【行动项】，格式漂移只在无人值守时发作。
// ⚠️ 2026-08-25 二次调整：strong 原本选了 qwen3.8-2.4t-a95b（2.4T 的 MoE），
// 结果校对端点回 **HTTP 502**，响应体是 Cloudflare 的 HTML 错误页。
// 判据：我们的函数全程 try/catch、**任何路径都返回 JSON**（连超时都是），
// 所以 HTML 一定是平台发的，不是我们的代码。
// 与 2026-08-12 那次 502 **不同源**：那次是请求体 5.3MB、`request.json()` 解析
// 撞 10ms CPU 上限；这次输入只有 78 个字，CPU 不可能是瓶颈——是模型太慢，
// Cloudflare 在我们 30 秒超时之前就断了连接。
// 交互端点对延迟敏感，大模型在这条路上不可用；把它留给不受 Cloudflare 限制的
// GitHub Actions 爬虫（batch）。
// ⚠️⚠️ 2026-08-25 三次调整：**qwen3.8-2.4t-a95b 是只能思考的模型**。
// 它拒绝 enable_thinking: false，直接回
//   HTTP 400 InternalError.Algo.InvalidParameter:
//   The value of the enable_thinking parameter is restricted to True.
// 也就是说这个模型的推理 token **无法关闭**，而我们所有调用都只读
// message.content、把推理直接丢弃 —— 它在这个项目里是纯粹的浪费，
// 无论跑在哪个平台。已从全部档位移除。
//
// **教训写在这里，别只留在提交信息里**：换模型时必须先验证
// "这个模型接不接受我们要传的参数"，不能假设同家族行为一致。
// 验证成本极低（一次调用），而没验证的代价是一整轮部署 + 一次用户点击。
// 见 scripts/ai-intel-scraper/probe-model.js。
export const TIERS = {
  strong: 'qwen3.8-27b', // 100%，2026-11-18。接受 enable_thinking:false（实测 17.6s → 2.2s）
  balanced: 'qwen3.8-27b', // 同上，共桶
  fast: 'qwen3.7-flash', // 余量未核实，见下方待办
  batch: 'qwen3.8-27b', // 同上。原为 a95b，因无法关闭思考而换掉
};

// ⚠️ **batch 与 strong 共桶是妥协，不是设计。** 上面写着"batch 单独一个模型是
// 刻意的：爬虫每晚成批跑，否则会喝掉白天交互工具依赖的那个桶"——这条判断没变，
// 只是控制台里**同家族且满额的文本模型只剩这两个**（作者只翻了第一页，共 486 个
// 模型 / 49 页，很可能还有）。
// 选择让 batch 跟 strong 共桶而不是跟 balanced：balanced 挂着 analyze，
// 而 analyze 单次约 23.7K token、08-13 一天烧掉 451K，是全站最大的消耗源；
// strong 那几个任务（翻译/校对/后台同步）量小且不定期。
//
// 🧑 待办：在控制台「我的试用」用模型名搜索框确认这几个的余量，
// 若有同家族、满额、到期晚于 11-12 的第三个文本模型，就把 batch 拆出去：
//   qwen3.7-flash（fast 正在用，余量未知）· qwen3.8-flash · qwen3.7-plus
//   qwen3.8-plus · qwen3.8-turbo
// 排除项不变：*-ocr / qwen-vl-*（视觉，另有独立桶）、*-thinking（推理，延迟不可接受）、
// qwen-math-*、*-code。

// Which tier each task needs, and why. This is the durable record of intent:
// tiers may collapse onto one model when quota forces it, but these
// assignments must survive that, so a later split restores the right shape.
export const TASK_TIER = {
  translate: 'strong', // text translation + back-translation verification
  translateStream: 'fast', // live interpretation, one call per utterance
  summary: 'balanced', // meeting minutes from a finished transcript
  analyze: 'balanced', // cross-document report, long output
  proofread: 'strong', // deep semantic proofreading
  lifestory: 'balanced', // interview → narrative
  // Nightly GitHub Actions scrapers (scripts/*), not Pages Functions.
  bidSummary: 'batch', // per-bid Japanese → Chinese summary, strict format
  aiIntel: 'batch', // relevance judgment + weekly digest
  // sdf-admin Worker (workers/sdf-admin), deployed separately via wrangler.
  // Strongest tier on purpose: it translates copy that gets published to the
  // live site, and it is invoked rarely (an editor pressing 「一键同步日英」),
  // so quality matters far more than latency or token spend.
  adminTranslate: 'strong',
};

// Per-task env override, e.g. QWEN_MODEL_TRANSLATE_STREAM=qwen-turbo.
// The scrapers pass process.env, so their two keys can be set from the workflow
// file or repository secrets — which, unlike the Pages env, we control.
const ENV_KEY = {
  translate: 'QWEN_MODEL_TRANSLATE',
  translateStream: 'QWEN_MODEL_TRANSLATE_STREAM',
  summary: 'QWEN_MODEL_SUMMARY',
  analyze: 'QWEN_MODEL_ANALYZE',
  proofread: 'QWEN_MODEL_PROOFREAD',
  lifestory: 'QWEN_MODEL_LIFESTORY',
  bidSummary: 'QWEN_MODEL_BID_SUMMARY',
  aiIntel: 'QWEN_MODEL_AI_INTEL',
  adminTranslate: 'QWEN_MODEL_ADMIN_TRANSLATE',
};

/**
 * Resolve the model id for a task.
 * @param {string} task one of the keys in TASK_TIER
 * @param {object} [env] Cloudflare env, consulted for an override first
 * @returns {string} model id for the compatible-mode endpoint
 */
export function modelFor(task, env) {
  const tier = TASK_TIER[task];
  if (!tier) throw new Error(`Unknown model task: ${task}`);
  return env?.[ENV_KEY[task]] || TIERS[tier];
}
