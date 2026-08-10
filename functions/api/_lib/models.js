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
// Both DashScope and SiliconFlow expose an OpenAI-compatible
// /v1/chat/completions, so a move is: (1) point CHAT_ENDPOINT at the new base,
// (2) replace the three TIERS ids with that provider's names, (3) update the
// API-key env var (still read as env.QWEN_API_KEY in each endpoint — rename it
// there and in the Cloudflare project settings together, or keep the name and
// just swap the value). Request/response shape needs no changes.
//   SiliconFlow: https://api.siliconflow.cn/v1/chat/completions
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
export const TIERS = {
  strong: 'qwen3.8-max',
  balanced: 'qwen3.7-plus-2026-05-26',
  fast: 'qwen3.7-flash',
  batch: 'qwen3.7-max-2026-06-08',
};

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
