// Rate limiting via Firestore REST API.
// Uses atomic field increment so concurrent requests don't race.
// Documents are bucketed per user per minute: rate_limits/{uid}_{YYYYMMDDHHmm}
// Fails open: if Firestore is unreachable, requests are allowed through.

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

export async function checkRateLimit(uid, idToken) {
  try {
    const res = await fetch(COMMIT_URL, {
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
      // 仍然放行（可用性优先），但**不再静默**——静默正是上面那个 bug 藏六周的原因。
      console.error(
        '[rateLimiter] Firestore commit failed:',
        res.status,
        await res.text().catch(() => ''),
      );
      return false;
    }

    const data = await res.json();
    const newCount = parseInt(
      data.writeResults?.[0]?.transformResults?.[0]?.integerValue ?? '1',
      10,
    );

    return newCount > RATE_LIMIT; // true = blocked
  } catch (err) {
    console.error('[rateLimiter] threw:', err?.message || err);
    return false; // fail open
  }
}
