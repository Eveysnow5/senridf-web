// 受発注デモの画像OCR：スキャン/画像ファイルを視覚モデルに送って読み取り＋構造化する。
// 送り先は models.js の demoProvider（専用鍵ありなら SiliconFlow の Gemma 4）。
// 専用鍵が無い間は demo-order-extract.js が画像を「準備中」として外すので、ここは呼ばれない。
//
// ⚠️⚠️ プライバシー上の重要な違い：
//   文字PDF/Excel/CSV は**ブラウザ内で読み取り**、AI整形時に読み取った文字だけ送る。
//   一方この画像OCRは、**画像そのものを当社サーバー経由で AI に送信する**。
//   したがってフロント（js/order-to-ledger-demo.js）で**明示同意（確認ダイアログ）**を
//   取ってから呼ぶこと。文言もその旨を明記する。
//
// なぜ _lib に置くか：視覚モデルは独立バケットで、テキストの TIERS/期限管理とは別系統。
// _lib は models.test / enable-thinking の走査対象外なので、視覚モデルは env 上書き可能な
// フォールバック付きで直接指定する（テキスト側の集中管理を汚さない）。
// 視覚モデルは enable_thinking 非対応のことがあるので送らない。

import { demoProvider, modelFor } from './models.js';
import { fetchWithTimeout } from './fetchWithTimeout.js';
import { recordUsage } from './usageRecorder.js';
import { buildDemoOrderPrompt } from './buildDemoOrderPrompt.js';

// 1 画像 ≈ h×w/1024 token（Qwen-VL）。dataURL の巨大化を防ぐため上限（base64 文字数）。
export const MAX_IMAGE_CHARS = 1_200_000; // ≈ 900KB

export function visionConfig(env) {
  const p = demoProvider(env);
  return {
    endpoint: env.DEMO_VISION_ENDPOINT || p.endpoint,
    apiKey: p.apiKey,
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
                text: buildDemoOrderPrompt('（下の画像の注文書を読み取ってください）'),
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
