// 全站调用大模型的唯一配置源：送到哪里（端点）、用哪把密钥、每个任务用哪个模型。
// functions/api/*、workers/sdf-admin、scripts/*（爬虫）都经 chatRoute()，tests/models.test.mjs 盯着没人绕过。
//
// 供应商：硅基流动海外站（api.siliconflow.com，SILICONFLOW LABS PTE. LTD.＝新加坡法人）。
// 2026-10-23 从阿里云百炼（DashScope）迁过来：百炼免费额度用尽、开着「只用免费额度」，全站 AI 403 了约一个月。
// 2026-10-24 拆掉了「没有硅基流动密钥就退回百炼」的后路——隐私政策只列硅基流动，
// 后路在密钥被误删/填错时会把用户内容悄悄发到政策里没写的地方（百炼会先收下请求内容再拒绝）。
// 现在没有密钥＝调用方直接报「未配置」，不发请求。tests/models.test.mjs 断言代码里不再出现百炼的地址。
// 百炼时代的选型记录（免费桶、到期日、a95b 不能关思考等）在 git 历史里：git log -p -- functions/api/_lib/models.js
//
// 密钥放在三处，各自独立（变量名都是 SILICONFLOW_API_KEY）：
//   · Pages Functions（functions/api/*）→ 同事 Cloudflare Pages 项目的环境变量（我们改不了，要她改）
//   · workers/sdf-admin                  → 我们自己的 Worker secret（wrangler secret put）
//   · scripts/*（爬虫）                  → 本仓库的 GitHub secret
//
// 模型按「档位」选（TASK_TIER → SF_TIERS），换模型只改 SF_TIERS。换之前先用
// .github/workflows/probe-model.yml 手动探一次：能不能用、接不接受 enable_thinking:false。
// 教训（2026-08-25）：同家族的模型行为不一定一致。qwen3.8-2.4t-a95b 只能思考，传 false 直接
//   HTTP 400 "The value of the enable_thinking parameter is restricted to True."
// 我们只读 message.content、推理 token 全部丢弃，这种模型在本项目里是纯浪费，不许进任何档位。
//
// NOTE: translation-specialised `qwen-mt-*` models are NOT drop-in here — they
// take `translation_options` instead of a system prompt, which would break the
// glossary injection and the 【原文】/【日本語訳】/【回訳】 output format.

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
  // 受発注ランディングの無料デモ抽出（functions/api/demo-order-extract.js）。
  // モデルは DEMO_PROVIDER（下）。専用鍵 DEMO_API_KEY があればそれで回してコストを分けられる。
  // 端点は DEMO_CHAT_ENDPOINT、モデル id は ENV_KEY 経由の DEMO_MODEL で上書き可。
  demoExtract: 'fast',
  // 受発注デモの画像OCR（スキャン/画像 → 視覚モデル）。functions/api/_lib/demoVision.js。
  demoVision: 'vision',
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
  // デモは別プロバイダに載せ替える前提なので、モデル id は DEMO_MODEL で上書きする。
  demoExtract: 'DEMO_MODEL',
  demoVision: 'DEMO_VISION_MODEL',
};

// ── 硅基流动海外站 ─────────────────────────────────────────────────────────────
// モデルは 2026-10-23 に作者の海外站キーで実測して決めた：
//   ・enable_thinking:false を受け付け、推理トークン 0（流式でも reasoning_content は出ない）
//   ・Qwen/Qwen3.8-27B：旧 DashScope の qwen3.8-27b と同系列同世代＝書式のずれが最小
//     （跨系列は作者が否決済み：招標摘要・会議纪要の固定書式が無人運用でずれるため）。画像入力も可
//   ・fast＝Qwen/Qwen3.6-35B-A3B：流式で初字 1.2 秒（実時間通訳用）
//   ・除外：Qwen/Qwen3-30B-A3B-Instruct-2507（日本語訳に韓国語「준비」が混入）
export const SF_ENDPOINT = 'https://api.siliconflow.com/v1/chat/completions';
export const SF_TIERS = {
  strong: 'Qwen/Qwen3.8-27B',
  balanced: 'Qwen/Qwen3.8-27B',
  fast: 'Qwen/Qwen3.6-35B-A3B',
  batch: 'Qwen/Qwen3.8-27B',
  vision: 'Qwen/Qwen3.8-27B',
};

/**
 * タスクの送り先を 1 か所で決める：{ provider, endpoint, apiKey, model }。
 * env は Pages の context.env / Worker の env / スクレイパーの process.env のどれでもよい。
 * キーが無いときは apiKey が空文字：呼び出し側は**送信せずに**「未配置」を返すこと（百炼へは退かない）。
 * モデルの env 上書き（QWEN_MODEL_* 等、名前は歴史的経緯）は優先する。
 */
export function chatRoute(task, env) {
  const tier = TASK_TIER[task];
  if (!tier) throw new Error(`Unknown model task: ${task}`);
  return {
    provider: 'siliconflow',
    endpoint: SF_ENDPOINT,
    apiKey: env?.SILICONFLOW_API_KEY || '',
    model: modelFor(task, env),
  };
}

// ── 受発注デモ ───────────────────────────────────────────────────────────────
// 専用鍵 DEMO_API_KEY（予充值）があればそれを、無ければサイト共通の SILICONFLOW_API_KEY を使う。
// どちらも同じ海外站・同じモデル。どちらも無ければ apiKey は空＝デモは「停止中」を返す（百炼へは退かない）。
// ⚠️ 鍵は siliconflow.com（海外站）で発行したもの。siliconflow.cn（国内站）の鍵とは別物で通らない
//    （2026-10-24 実際に取り違えて 401「Token is invalid」）。
// ⚠️ SiliconFlow の規約はサーバーの所在地を明記していない。「中国を経由しない」とは書けない。
// 2026-10-23：モデルを Gemma 4 → Qwen/Qwen3.6-35B-A3B に変更（Gemma は初回 25 秒で 30 秒タイムアウトに迫った）。
// visionModel は画像を正しく読めた Qwen/Qwen3.8-27B。受発注の画像経路は正解表で未検証なので
// demo-order-extract の VISION_READY=false のまま。
export const DEMO_PROVIDER = {
  endpoint: SF_ENDPOINT,
  model: 'Qwen/Qwen3.6-35B-A3B',
  visionModel: 'Qwen/Qwen3.8-27B',
  // 公開ページに出す名称。固有名詞だけなので三語共通。
  label: 'Qwen 3.6 · SiliconFlow',
};

const DEMO_MODEL_FIELD = { demoExtract: 'model', demoVision: 'visionModel' };

/**
 * 受発注デモが**実際に**どこへ送るか。ページの開示文言はこの label を表示するので、
 * 経路と表示がずれないよう、送信側（端点）と表示側の両方がここだけを読む。
 */
export function demoProvider(env) {
  const apiKey = env?.DEMO_API_KEY || env?.SILICONFLOW_API_KEY || '';
  return {
    dedicated: !!apiKey,
    apiKey,
    endpoint: env?.DEMO_CHAT_ENDPOINT || DEMO_PROVIDER.endpoint,
    // env でモデルを上書きした場合は、その id をそのまま表示する（名称を偽らない）。
    label: env?.DEMO_MODEL || DEMO_PROVIDER.label,
  };
}

/**
 * Resolve the model id for a task.
 * @param {string} task one of the keys in TASK_TIER
 * @param {object} [env] env, consulted for an override first
 */
export function modelFor(task, env) {
  const tier = TASK_TIER[task];
  if (!tier) throw new Error(`Unknown model task: ${task}`);
  const override = env?.[ENV_KEY[task]];
  if (override) return override;
  if (DEMO_MODEL_FIELD[task]) return DEMO_PROVIDER[DEMO_MODEL_FIELD[task]];
  return SF_TIERS[tier];
}
