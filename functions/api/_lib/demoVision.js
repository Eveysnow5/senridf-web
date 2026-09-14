// 受発注デモの画像OCR：スキャン/画像ファイルを視覚モデル（通義千問VL）に送って
// 読み取り＋構造化する。
//
// ⚠️⚠️ プライバシー上の重要な違い：
//   文字PDF/Excel/CSV は**ブラウザ内で処理**し、テキストのみ送る（原本ファイルは非送信）。
//   一方この画像OCRは、**画像を当社サーバー経由で通義千問(Qwen)の視覚モデルに送信する**。
//   したがってフロント（js/order-to-ledger-demo.js）で**明示同意（確認ダイアログ）**を
//   取ってから呼ぶこと。文言もその旨を明記する。
//
// なぜ _lib に置くか：視覚モデルは独立バケットで、テキストの TIERS/期限管理とは別系統。
// _lib は models.test / enable-thinking の走査対象外なので、視覚モデルは env 上書き可能な
// フォールバック付きで直接指定する（テキスト側の集中管理を汚さない）。
// 視覚モデルは enable_thinking 非対応のことがあるので送らない。

import { CHAT_ENDPOINT, modelFor } from './models.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';
import { recordUsage } from './usageRecorder.js';
import { buildDemoOrderPrompt } from './buildDemoOrderPrompt.js';

// 1 画像 ≈ h×w/1024 token（Qwen-VL）。dataURL の巨大化を防ぐため上限（base64 文字数）。
export const MAX_IMAGE_CHARS = 1_200_000; // ≈ 900KB

export function visionConfig(env) {
  return {
    endpoint: env.DEMO_VISION_ENDPOINT || env.DEMO_CHAT_ENDPOINT || CHAT_ENDPOINT,
    apiKey: env.DEMO_API_KEY || env.QWEN_API_KEY,
  };
}

/**
 * 画像（data:image/...;base64,...）を視覚モデルに送り、生の応答テキストを返す。
 * JSON パースは呼び出し側（demo-order-extract.js の parseLedger）。
 */
export async function visionExtract({ env, dataUrl, idToken, context }) {
  const cfg = visionConfig(env);
  const res = await fetchWithTimeout(
    cfg.endpoint,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // model と enable_thinking は同一オブジェクト内（tests/enable-thinking が固定）。
        model: modelFor('demoVision', env),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildDemoOrderPrompt('（下の画像の帳票を読み取ってください）'),
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 2000,
        // 視覚モデルが受けるかは要スモークテスト（受けない場合は demoVision で外す）。
        enable_thinking: false,
      }),
    },
    45000, // 視覚は少し長めのタイムアウト
  );
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('AIVL: ' + err);
  }
  const dataR = await res.json();
  recordUsage({
    task: 'demoExtract',
    usage: dataR.usage,
    idToken,
    waitUntil: context.waitUntil?.bind(context),
  });
  return dataR.choices?.[0]?.message?.content ?? '';
}
