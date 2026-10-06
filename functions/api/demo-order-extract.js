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
import { demoProvider, modelFor } from './_lib/models.js';
import { checkInputSize, quotaDecision, limitsFor, DEMO_LIMITS } from './_lib/demoQuota.js';
import { bumpDemoCounters } from './_lib/demoCounters.js';
import { buildDemoOrderPrompt, LEDGER_COLUMNS } from './_lib/buildDemoOrderPrompt.js';
import { visionExtract, MAX_IMAGE_CHARS } from './_lib/demoVision.js';

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

// 1 ファイル分のテキストを LLM で構造化して行配列にする。
async function extractOne({ endpoint, apiKey, env, text, idToken, context }) {
  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // model と enable_thinking は同一オブジェクト内に（tests/enable-thinking が固定）。
      model: modelFor('demoExtract', env),
      messages: [{ role: 'user', content: buildDemoOrderPrompt(text) }],
      max_tokens: 2000,
      // 推理モードは読み捨てになるので切る（proofread.js と同じ理由）。
      enable_thinking: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('AI: ' + err);
  }
  const dataR = await res.json();
  recordUsage({
    task: 'demoExtract',
    usage: dataR.usage,
    idToken,
    waitUntil: context.waitUntil?.bind(context),
  });
  return parseLedger(dataR.choices?.[0]?.message?.content ?? '');
}

// 複数ファイルの行を 1 枚に合并。列は「ファイル」＋固定の LEDGER_COLUMNS。
// モデルが返した余計なキーは捨て、欠けたキーは空にする＝表の形はコードが保証する。
// 固定列がすべて空の行（列名を外した応答など）は捨てる：中身の無い行で埋めず、
// 全滅なら呼び出し側で「失敗」として見せる（見える失敗＞黙った空行）。
export function mergeRows(perFile) {
  const columns = ['ファイル', ...LEDGER_COLUMNS];
  const rows = [];
  for (const f of perFile) {
    for (const row of f.rows) {
      if (!row || typeof row !== 'object') continue;
      const out = { ファイル: f.name };
      let filled = 0;
      for (const k of LEDGER_COLUMNS) {
        const v = row[k] == null ? '' : String(row[k]).trim();
        out[k] = v;
        if (v) filled++;
      }
      if (filled) rows.push(out);
    }
  }
  return { columns, rows };
}

export async function onRequest(context) {
  const { request, env, data } = context;

  // 鍵の解決（A+B 両対応、2026-09-14 / 送り先は 2026-10-06 に models.demoProvider へ集約）：
  //   B（本命）: DEMO_API_KEY（SiliconFlow 国際站の予充值。専用・隔離。残高がハード天井）。
  //   A（暫定）: 無ければ既存の QWEN_API_KEY（DashScope）に fallback。
  // 専用キーがあるときは 500/日、共有キーに fallback 中は 50/日に絞って本番ツールの
  // 無料桶を守る（08-24 の枯渇事故の教訓）。SiliconFlow キーを入れれば自動で 500 に戻る。
  // 変数名は aiRoute（下の provider＝ログイン種別 と取り違えないため）。
  const aiRoute = demoProvider(env);
  const onDedicatedKey = aiRoute.dedicated;
  const apiKey = aiRoute.apiKey;

  // GET＝「今どの AI に送るか」だけを返す（送信前の開示用。AI は呼ばない・回数も消費しない）。
  // 経路が A/B どちらでも、ページの表示が実際の送り先と一致するようにここから出す。
  if (request.method === 'GET') return json(200, { ai: apiKey ? aiRoute.label : null });
  if (request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

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

  // items: [{name, text?|image?, pageCount}]（1〜maxFiles 件）。text はブラウザ内解析済み、
  // image は data:URL（スキャン/画像＝視覚モデル送信）。後方互換で単一 {text} も 1 件扱い。
  const rawItems = Array.isArray(body.items)
    ? body.items
    : typeof body.text === 'string'
      ? [{ name: '', text: body.text, pageCount: body.pageCount }]
      : [];
  const items = rawItems
    .filter((it) => it && (typeof it.text === 'string' || typeof it.image === 'string'))
    .map((it) => ({
      name: String(it.name || '').slice(0, 120),
      text: typeof it.text === 'string' ? it.text.trim() : '',
      image: typeof it.image === 'string' ? it.image : '',
      pageCount: Number(it.pageCount),
    }))
    .filter((it) => it.text || it.image);

  if (!items.length) return json(400, { error: 'empty' });
  if (items.length > DEMO_LIMITS.maxFiles) return json(413, { error: 'too_many_files' });

  // 0) 視覚OCR（画像）は専用付費キー（DEMO_API_KEY）運用時のみ。
  //    共有の無料桶には視覚の無料枠が無い（2026-10-05 probe で qwen-vl-plus=403
  //    「Free quota exhausted」を確認）。専用キーが無い間に画像を視覚モデルへ送れば
  //    必ずエラーになり、しかも bumpDemoCounters が先に走るので**ユーザーの無料回数を
  //    無駄に消費する**。そこで専用キーが無い間は画像を「準備中」として受理前に外し、
  //    回数も消費しない。DEMO_API_KEY を入れれば自動で画像も処理対象に戻る。
  const servedItems = onDedicatedKey ? items : items.filter((it) => !it.image);
  const visionPending = items.length - servedItems.length;
  if (!servedItems.length) {
    // 全部が画像で専用キーが無い → 回数を消費せず「準備中」を返す（200・空）。
    if (visionPending)
      return json(200, { columns: [], rows: [], files: 0, failed: 0, visionPending });
    return json(400, { error: 'empty' });
  }

  // 1) 入力サイズ（ハード）: ファイルごとに。1 つでも超えたらバッチごと拒否。
  //    画像は dataURL 長で、テキストは文字数で判定。
  for (const it of servedItems) {
    if (it.image) {
      if (it.image.length > MAX_IMAGE_CHARS) return json(413, { error: 'too_long' });
    } else {
      const sz = checkInputSize({ provider, text: it.text, pageCount: it.pageCount });
      if (!sz.ok) return json(sz.code, { error: sz.error });
    }
  }

  // 2) 配額（ソフト、fail-close）。uid/ip は「使用回数(バッチ=1)」で +1、global は
  //    実 AI 呼び出し数 = ファイル数で +N（コスト＝呼び出し数）。先に増やしてから判定。
  const counts = await bumpDemoCounters({
    uid: user.uid,
    ip: request.headers.get('CF-Connecting-IP'),
    idToken,
    globalInc: servedItems.length,
  });
  const q = quotaDecision({
    provider,
    uidCount: counts.uid,
    ipCount: counts.ip,
    globalCount: counts.global,
    globalDailyCap,
  });
  if (!q.ok) return json(q.code, { error: q.error });

  // 3) 各ファイルを並列で LLM 構造化 → 合并。独立プロバイダ対応：エンドポイント/モデルは
  //    DEMO_CHAT_ENDPOINT / DEMO_MODEL(=modelFor の env 上書き) で差し替え可能。
  //    1 件が失敗しても他は返す（allSettled）。全滅なら 502。
  const endpoint = aiRoute.endpoint;
  const lim = limitsFor(provider);
  const settled = await Promise.allSettled(
    servedItems.map((it) => {
      if (it.image) {
        // 画像＝視覚モデル（通義千問VL）。フロントで同意ダイアログを取ってから送られてくる。
        return visionExtract({ env, dataUrl: it.image, idToken, context }).then((content) => ({
          name: it.name,
          rows: parseLedger(content),
        }));
      }
      return extractOne({
        endpoint,
        apiKey,
        env,
        text: it.text.slice(0, lim.maxChars),
        idToken,
        context,
      }).then((rows) => ({ name: it.name, rows }));
    }),
  );
  const perFile = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!perFile.length) return json(502, { error: 'unavailable' });

  const merged = mergeRows(perFile);
  return json(200, {
    columns: merged.columns,
    rows: merged.rows,
    ai: aiRoute.label,
    files: perFile.length,
    failed: servedItems.length - perFile.length,
    visionPending, // 専用キーが無く「準備中」として外した画像の件数（0 のことが多い）
  });
}
