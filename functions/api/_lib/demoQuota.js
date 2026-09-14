// 受発注デモの「入力上限」と「配額」判定（純ロジック、テスト可能）。
//
// なぜ純関数に切り出すか：ここは「どれだけ無料で使わせるか＝お金」を決める箇所で、
// 一番テストで固めたい。IO（Firestore カウンタ）は demoCounters.js、
// 呼び出しは demo-order-extract.js。
//
// 護りの層（demo-order-extract.js のコメントも参照）：
//   🔒 ハード（サーバ強制・改ざん不可）: 入力サイズ上限（=単発コストの実質上限）
//   🚧 ソフト（Firestore カウンタ・改ざん可）: uid/IP/全站の回数（rateLimiter と同じ弱点）
//   🧯 真のハード底（コード外）: DEMO_API_KEY の残高（SiliconFlow 予充值）

export const DEMO_LIMITS = {
  // lifetimeUses は「その uid で通算何回まで」。匿名 uid はキャッシュ削除で作り直せるので
  // 実質ソフト。会員 uid は安定なので意味がある上限。
  anonymous: { maxChars: 3000, maxPages: 1, lifetimeUses: 1 },
  member: { maxChars: 10000, maxPages: 5, lifetimeUses: 3 },
  ipDaily: 5, // 1 IP / 1 日
  globalDaily: 500, // 全站 / 1 日（作者が 2026-09-13 に決定）
  maxFiles: 10, // 1 回のバッチで処理できるファイル数（2026-09-14）
};

export function isMemberProvider(provider) {
  return !!provider && provider !== 'anonymous';
}

export function limitsFor(provider) {
  return isMemberProvider(provider) ? DEMO_LIMITS.member : DEMO_LIMITS.anonymous;
}

// 入力サイズ判定（ハード）。text 長と pageCount を上限と照合。
// これはサーバ側で必ず通す＝単発コストの上限。改ざん不可。
export function checkInputSize({ provider, text, pageCount } = {}) {
  const lim = limitsFor(provider);
  const len = typeof text === 'string' ? text.length : 0;
  if (len === 0) return { ok: false, code: 400, error: 'empty' };
  if (len > lim.maxChars) return { ok: false, code: 413, error: 'too_long' };
  if (Number.isFinite(pageCount) && pageCount > lim.maxPages) {
    return { ok: false, code: 413, error: 'too_many_pages' };
  }
  return { ok: true };
}

// 配額判定（ソフト）。カウンタの「インクリメント後」の値を受け取り、超過なら拒否。
//
// ⚠️ fail-close：どれか一つでも null（＝カウンタ読み取り失敗）なら拦（お金を守る、
//    rateLimiter と同じ向き）。呼び出し側は bumpDemoCounters が失敗したら null を渡す。
//
// カウント意味論：先にインクリメントしてから「> 上限」で判定する。
//   匿名 lifetimeUses=1 → 1回目 count=1（1>1 偽＝許可）、2回目 count=2（2>1 真＝拒否）＝ちょうど1回。
//   会員=3 → 1..3 許可、4回目で拒否＝ちょうど3回。全站=500 → 500 許可、501 で拒否。
// globalDailyCap は全站日次上限の上書き（省略時は DEMO_LIMITS.globalDaily=500）。
// 専用キー（SiliconFlow 予充值）なら 500、共有 QWEN キーに fallback 中は低めにして
// 本番ツールの無料桶を守る、という運用のため端点から差し込めるようにしている。
export function quotaDecision({ provider, uidCount, ipCount, globalCount, globalDailyCap } = {}) {
  if (uidCount == null || ipCount == null || globalCount == null) {
    return { ok: false, code: 503, error: 'counter_unavailable' };
  }
  const gCap = Number.isFinite(globalDailyCap) ? globalDailyCap : DEMO_LIMITS.globalDaily;
  if (globalCount > gCap) {
    return { ok: false, code: 429, error: 'global_daily' };
  }
  if (ipCount > DEMO_LIMITS.ipDaily) {
    return { ok: false, code: 429, error: 'ip_daily' };
  }
  const lim = limitsFor(provider);
  if (uidCount > lim.lifetimeUses) {
    return {
      ok: false,
      code: 429,
      error: isMemberProvider(provider) ? 'member_used_up' : 'anon_used_up',
    };
  }
  return { ok: true };
}
