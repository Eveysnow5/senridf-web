// Rate limiting via Firestore REST API.
// Uses atomic field increment so concurrent requests don't race.
// Documents are bucketed per user per minute: rate_limits/{uid}_{YYYYMMDDHHmm}
//
// ⚠️ **Fails CLOSED（2026-09-11 从 fail-open 改过来）**：限流器自己出故障时，
// 拦，不放行。它护的是**钱**——放行＝无上限烧 Qwen/Deepgram 的额度。
// 2026-07~08 这里 fail-open 加上一个静默 bug，导致限流六周形同虚设无人察觉。
// fail-close 把「静默漏钱」换成「响亮的宕机」：真坏了用户立刻看到 429，会被马上修，
// 而不是月底看账单才发现。可用性代价（Firestore 抖动时的短暂 429）是有意接受的。

// 120/min: voice interpretation calls /api/translate-stream once per utterance,
// so keep generous headroom for busy meetings (function-first). Still stops abuse.
const RATE_LIMIT = 120; // max requests per minute per user
const FIRESTORE_PROJECT = 'senridfauthentication';

// ⚠️ 两个地址长得像但用途不同，别再合并：
//   COMMIT_URL  —— 要打的 HTTP 端点，必须是完整 https:// URL
//   DOC_BASE    —— 写进 body 的 transform.document，必须是**资源名**（projects/… 开头）
// 2026-07-01～08-10 这里传的是完整 URL，Firestore 每次都回
// 400 INVALID_ARGUMENT: Document name "https://…" lacks "projects" at index 0，
// 然后被 `if (!res.ok) return false` 静默吞掉 → 限流整整六周从未生效（一直放行）。
const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:commit`;
const DOC_BASE = `projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

// 纯函数，便于测试：算出这一分钟这个用户的桶的资源名。
export function rateLimitDocName(uid, now = new Date()) {
  const minute = now.toISOString().slice(0, 16).replace(/\D/g, ''); // "202506251430"
  return `${DOC_BASE}/rate_limits/${uid}_${minute}`;
}

export async function checkRateLimit(uid, idToken, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(COMMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        writes: [
          {
            transform: {
              document: rateLimitDocName(uid),
              fieldTransforms: [
                {
                  fieldPath: 'count',
                  increment: { integerValue: '1' },
                },
              ],
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      // fail-close：限流器坏了就拦（护钱）。不静默——静默正是上个 bug 藏六周的原因。
      console.error(
        '[rateLimiter] Firestore commit failed → 拦截（fail-close）:',
        res.status,
        await res.text().catch(() => ''),
      );
      return true;
    }

    const data = await res.json();
    const newCount = parseInt(
      data.writeResults?.[0]?.transformResults?.[0]?.integerValue ?? '1',
      10,
    );

    return newCount > RATE_LIMIT; // true = blocked
  } catch (err) {
    console.error('[rateLimiter] threw → 拦截（fail-close）:', err?.message || err);
    return true; // fail closed —— 护钱优先，见文件头
  }
}
