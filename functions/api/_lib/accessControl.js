// /api/* 的访问准入策略。**纯函数，无 IO**，所以能穷举测 + 突变验证。
// IO（读 users/{uid}.status）在 userStatus.js，中转在 _middleware.js。
//
// ── 为什么需要它（2026-09-11 的两个洞）────────────────────────────────────────
// 1. verifyFirebaseToken 原来只验 token 真假，不看登录方式。而站点给**每个访客**
//    都做了匿名登录，那张匿名 token 同样 aud/iss 合法 —— 于是 /api/* 的真实门槛
//    是「任何打开过网站的人」，不是「登录的会员」。任何访客都能直接调烧钱的
//    翻译/分析/语音端点。**这一条是主洞。**
// 2. 会员审核（pending/approved/disabled）只在前端界面判，后端不查。注册了但没通过
//    审核的人，绕开界面也能调 API。
//
// ── 两种「不放行」的失败取向不同，别合并 ────────────────────────────────────
// - **匿名**：无条件拒。这是主洞，而且是 token 里的字段，读不出错，永远能判。
// - **审核状态**：要读 Firestore。**读失败时放行**（fail-open），因为：
//     · 主洞已被「拒匿名」堵死 —— 能走到这一步的一定是**非匿名、有真实邮箱**的账号；
//     · 限流仍然生效；
//   而反过来 fail-close 会让任意一次 Firestore 抖动**关掉所有人的所有工具**。
//   残余风险（一个 pending 用户在读失败的窗口里用了工具）极小且可追溯。
//   ⚠️ 注意这和限流的 fail-close（rateLimiter.js）取向相反，是**故意的**：
//     限流护的是钱，放行＝无上限烧钱；这里护的是「未审核」，放行的代价小得多。

/**
 * @param {object} a
 * @param {string|null} a.provider     firebase.sign_in_provider（匿名是 'anonymous'）
 * @param {boolean} a.isAdmin          调用者是否管理员（按邮箱名单）
 * @param {boolean} a.statusKnown      users/{uid}.status 是否读到了确定值
 * @param {string|null} a.status       读到的状态（statusKnown 为 true 时才有意义）
 * @returns {{ok: boolean, code?: number, error?: string}}
 */
export function accessDecision({ provider, isAdmin, statusKnown, status }) {
  // 1) 匿名：无条件拒。这是主洞。
  if (provider === 'anonymous' || provider == null) {
    return { ok: false, code: 403, error: '此功能仅限登录会员使用，请登录后再试。' };
  }
  // 2) 管理员：按邮箱认，不要求 users 文档存在或 status=approved
  //    （管理员可能压根没有 users 文档）。
  if (isAdmin) return { ok: true };
  // 3) 审核状态读失败：fail-open（理由见文件头）。
  if (!statusKnown) return { ok: true };
  // 4) 明确的状态判定
  if (status === 'approved') return { ok: true };
  if (status === 'disabled') {
    return { ok: false, code: 403, error: '账号已停用，请联系管理员。' };
  }
  // pending / null / 任何其他值 —— 未通过审核
  return { ok: false, code: 403, error: '账号审核中，通过后即可使用各工具。' };
}
