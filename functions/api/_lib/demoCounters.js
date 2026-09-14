// 受発注デモの配額カウンタ（Firestore REST・原子インクリメント）。
// rateLimiter.js と同じ方式：呼び出し者自身の ID トークンで書く（Pages Functions には
// サーバ credential が無いため）。したがってこのカウンタは**ソフト**——rateLimiter と
// 同じく、その気になれば改ざんできる。真のハード底は DEMO_API_KEY の残高（demoQuota.js 参照）。
//
// ⚠️ 3 つのカウンタを 1 コミットで増やし、増加後の値を返す。失敗時は全部 null →
//    quotaDecision が fail-close で拦（お金を守る）。
//
// ⚠️ rateLimiter.js の血の教訓を踏襲：transform.document は**リソース名**
//    （projects/… で始まる）で、コミット先の URL とは別物。混ぜると
//    400 で静かに死ぬ（限流が六週間形骸化した原因）。

const FIRESTORE_PROJECT = 'senridfauthentication';
const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:commit`;
const DOC_BASE = `projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

function dayStr(now) {
  return now.toISOString().slice(0, 10).replace(/\D/g, ''); // "20260914"
}

// IP をドキュメント ID に使うためサニタイズ（英数・: . のみ、長さ制限）。
export function sanitizeIp(ip) {
  const s = String(ip || 'unknown')
    .replace(/[^0-9a-fA-F:.]/g, '_')
    .slice(0, 45);
  return s || 'unknown';
}

export function demoUidDoc(uid) {
  return `${DOC_BASE}/demo_quota/${uid}`;
}
export function demoIpDoc(ip, now = new Date()) {
  return `${DOC_BASE}/demo_quota_ip/${dayStr(now)}_${sanitizeIp(ip)}`;
}
export function demoDayDoc(now = new Date()) {
  return `${DOC_BASE}/demo_quota_day/${dayStr(now)}`;
}

/**
 * 3 つのカウンタ（uid 通算 / IP・日 / 全站・日）を 1 コミットでインクリメントし、
 * 増加後の値を返す。失敗時は {uid:null, ip:null, global:null}（fail-close は呼び出し側）。
 */
export async function bumpDemoCounters({
  uid,
  ip,
  idToken,
  fetchImpl = fetch,
  now = new Date(),
  globalInc = 1,
}) {
  // uid/ip は「使用回数（バッチ=1回）」で +1、global は「実 AI 呼び出し数」で +N
  // （バッチのファイル数）。コスト＝AI 呼び出し数なので global だけ N で数える。
  const inc = (document, n) => ({
    transform: {
      document,
      fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: String(n) } }],
    },
  });
  try {
    const res = await fetchImpl(COMMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        writes: [
          inc(demoUidDoc(uid), 1),
          inc(demoIpDoc(ip, now), 1),
          inc(demoDayDoc(now), globalInc),
        ],
      }),
    });
    if (!res.ok) {
      console.error(
        '[demoCounters] commit failed → fail-close:',
        res.status,
        await res.text().catch(() => ''),
      );
      return { uid: null, ip: null, global: null };
    }
    const data = await res.json();
    const val = (i) => {
      const v = data.writeResults?.[i]?.transformResults?.[0]?.integerValue;
      return v == null ? null : parseInt(v, 10);
    };
    return { uid: val(0), ip: val(1), global: val(2) };
  } catch (err) {
    console.error('[demoCounters] threw → fail-close:', err?.message || err);
    return { uid: null, ip: null, global: null };
  }
}
