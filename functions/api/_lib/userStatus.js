// 读 users/{uid}.status，走 Firestore REST，用**调用者自己的** ID token 授权
// （与 rateLimiter / usageRecorder 同一套；规则允许本人读自己的 users 文档）。
//
// 返回 { known: true, status } 或 { known: false }（读失败 / 文档不存在 / 无 status）。
// **known:false 的处理在 accessControl.js —— 那里对读失败是 fail-open，见其文件头。**

const FIRESTORE_PROJECT = 'senridfauthentication';

// ⚠️ 抄 rateLimiter.js 顶部那条血泪注释：
//   GET_BASE 是要打的 HTTP 端点，必须是完整 https:// URL。
//   传错（比如塞成资源名）会 4xx，被下面 catch 成 known:false —— 那会让审核检查
//   静默 fail-open，等于没查。所以这条 URL 有测试钉着（userStatus.test.mjs）。
const GET_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/users`;

/** 纯函数：拼出读某个用户文档的 URL。便于测试它确实是 https 端点。 */
export function userDocUrl(uid) {
  return `${GET_BASE}/${encodeURIComponent(uid)}`;
}

/**
 * @param {string} uid
 * @param {string} idToken 调用者的 Firebase ID token
 * @param {typeof fetch} [fetchImpl] 便于测试注入
 * @returns {Promise<{known: boolean, status?: string|null}>}
 */
export async function getUserStatus(uid, idToken, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(userDocUrl(uid), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    // 文档不存在（首次注册竞态等）→ 当作「读到了，但没有状态」，交给策略判 pending。
    if (res.status === 404) return { known: true, status: null };
    if (!res.ok) {
      // 其他错误（权限/网络/5xx）→ 读失败，交给策略 fail-open。**不静默**。
      console.error('[userStatus] read failed:', res.status, await res.text().catch(() => ''));
      return { known: false };
    }
    const data = await res.json();
    // Firestore REST 的字段形如 { fields: { status: { stringValue: 'approved' } } }
    const status = data?.fields?.status?.stringValue ?? null;
    return { known: true, status };
  } catch (err) {
    console.error('[userStatus] threw:', err?.message || err);
    return { known: false };
  }
}
