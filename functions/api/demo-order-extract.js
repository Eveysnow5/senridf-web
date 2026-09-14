// 受発注デモの抽出端点：注文書テキスト → 受注台帳（構造化 JSON）。
//
// ⚠️ この端点は _middleware の「拒匿名」を**意図的に受ける例外**（受控例外）。
//    匿名でも呼べる代わりに、以下で厳しく縛る：
//    🔒 ハード（サーバ強制）: 入力サイズ上限（demoQuota.checkInputSize）、固定プロンプト、
//       独立キー DEMO_API_KEY（未設定なら無効＝準備中。線上工具の鍵/桶とは分離）。
//    🚧 ソフト（Firestore カウンタ）: 匿名1/会員3/IP日次/全站500・日（demoCounters + quotaDecision）。
//    🧯 真のハード底: DEMO_API_KEY の残高（SiliconFlow 予充值。超えたら止まる）。
//
// フロントは js/order-to-ledger-demo.js。ブラウザ側で解析した「テキスト」だけを送る
// （原本ファイルは送らない＝信頼文案の裏付け）。

import { fetchWithTimeout } from './_lib/fetchWithTimeout.js';
import { recordUsage } from './_lib/usageRecorder.js';
import { CHAT_ENDPOINT, modelFor } from './_lib/models.js';
import { checkInputSize, quotaDecision, limitsFor } from './_lib/demoQuota.js';
import { bumpDemoCounters } from './_lib/demoCounters.js';
import { buildDemoOrderPrompt } from './_lib/buildDemoOrderPrompt.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// LLM の返答から受注台帳の行配列を頑健に取り出す。
export function parseLedger(content) {
  if (typeof content !== 'string') return [];
  let s = content.trim();
  // コードフェンスが付いてきた場合に剥がす。
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // それでも前後にゴミがある場合、最初の { と最後の } を取る。
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first > 0 || last < s.length - 1) {
    if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  }
  try {
    const o = JSON.parse(s);
    const rows = Array.isArray(o) ? o : o && Array.isArray(o.rows) ? o.rows : null;
    if (Array.isArray(rows)) return rows.slice(0, 200);
  } catch {
    // fall through
  }
  return [];
}

export async function onRequest(context) {
  const { request, env, data } = context;
  if (request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  // 鍵の解決（A+B 両対応、2026-09-14）：
  //   B（本命）: DEMO_API_KEY（SiliconFlow 予充值など、専用・隔離。残高がハード天井）。
  //   A（暫定）: 無ければ既存の QWEN_API_KEY に fallback ＝ 同事の env 変更を待たず今すぐ動く。
  // 専用キーがあるときは 500/日、共有キーに fallback 中は 50/日に絞って本番ツールの
  // 無料桶を守る（08-24 の枯渇事故の教訓）。SiliconFlow キーを入れれば自動で 500 に戻る。
  const onDedicatedKey = !!env.DEMO_API_KEY;
  const apiKey = env.DEMO_API_KEY || env.QWEN_API_KEY;
  if (!apiKey) return json(503, { disabled: true, error: 'demo_disabled' });
  const globalDailyCap = onDedicatedKey ? undefined : 50; // undefined＝既定 500

  const user = data?.user;
  const idToken = data?.idToken;
  if (!user || !idToken) return json(401, { error: 'unauthorized' });
  const provider = user.provider ?? null;

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const pageCount = Number(body.pageCount);

  // 1) 入力サイズ（ハード）
  const sz = checkInputSize({ provider, text, pageCount });
  if (!sz.ok) return json(sz.code, { error: sz.error });

  // 2) 配額（ソフト、fail-close）。先にカウンタを増やしてから判定。
  const counts = await bumpDemoCounters({
    uid: user.uid,
    ip: request.headers.get('CF-Connecting-IP'),
    idToken,
  });
  const q = quotaDecision({
    provider,
    uidCount: counts.uid,
    ipCount: counts.ip,
    globalCount: counts.global,
    globalDailyCap,
  });
  if (!q.ok) return json(q.code, { error: q.error });

  // 3) LLM 呼び出し（固定プロンプト）。独立プロバイダ対応：エンドポイント/モデルは
  //    DEMO_CHAT_ENDPOINT / DEMO_MODEL(=modelFor の env 上書き) で差し替え可能。
  const endpoint = env.DEMO_CHAT_ENDPOINT || CHAT_ENDPOINT;
  const lim = limitsFor(provider);
  const input = text.slice(0, lim.maxChars);

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // model と enable_thinking は同一オブジェクト内に（tests/enable-thinking が固定）。
        model: modelFor('demoExtract', env),
        messages: [{ role: 'user', content: buildDemoOrderPrompt(input) }],
        max_tokens: 2000,
        // 推理モードは読み捨てになるので切る（proofread.js と同じ理由）。
        enable_thinking: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return json(502, { error: `AI: ${err}` });
    }
    const dataR = await res.json();
    recordUsage({
      task: 'demoExtract',
      usage: dataR.usage,
      idToken,
      waitUntil: context.waitUntil?.bind(context),
    });
    const content = dataR.choices?.[0]?.message?.content ?? '';
    const ledger = parseLedger(content);
    return json(200, { ledger });
  } catch (err) {
    return json(502, { error: err.name === 'AbortError' ? 'timeout' : 'unavailable' });
  }
}
