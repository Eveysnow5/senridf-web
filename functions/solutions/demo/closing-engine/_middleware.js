// 月结引擎的代码包（jpclose-bundle.zip）只给登录、并且审核通过的会员（2026-10-14 作者：代码要做一些保护）。
//
// 页面本身有登录门（auth-gate），但那只是界面：代码包是静态文件，以前不登录也能直接下载。
// 这里在服务器上拦住它，判据和 /api/* 完全一样（functions/api/_middleware.js）：
//   · 没有 token、token 无效 → 401
//   · 匿名登录（站点给每个访客都做了匿名登录）→ 拒
//   · 审核状态：读到 pending/disabled → 拒；读失败 → 放行（理由见 api/_lib/accessControl.js 的文件头）
// 只拦代码包。模板（空白的公司资料表）、wheel（PyPI 上公开的包）、manifest 照常公开——
// 页面上「下载空白模板」是普通链接，带不了 token。
//
// 这挡得住随手下载，挡不住登录了的会员把代码包存下来：真正的保护是费率表的更新和服务（见工具档案 09）。

import { verifyFirebaseToken } from '../../../api/_lib/verifyFirebaseToken.js';
import { accessDecision } from '../../../api/_lib/accessControl.js';
import { getUserStatus } from '../../../api/_lib/userStatus.js';
import { isAdmin } from '../../../../js/shared/admins.js';

export const GATED = /\/jpclose-bundle\.zip$/i;

// 判断前先解码：/jpclose%2Dbundle.zip 这样的写法，静态文件服务可能照样给出代码包，原样比对会漏过去。
// 解不开的（坏的 % 编码）一律当成要拦
function gatedPath(pathname) {
  try {
    return GATED.test(decodeURIComponent(pathname));
  } catch {
    return true;
  }
}

function deny(code, error) {
  return new Response(JSON.stringify({ error }), {
    status: code,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// deps 可以换成假的（测试用）：verify(token) → user，status(uid, token) → {known, status}，admin(user) → bool
export function makeGate(deps) {
  return async function onRequest(context) {
    const { request } = context;
    if (!gatedPath(new URL(request.url).pathname)) return context.next();
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return deny(401, 'login required');
    let user;
    try {
      user = await deps.verify(token);
    } catch {
      return deny(401, 'invalid token');
    }
    const admin = user.provider === 'anonymous' ? false : deps.admin(user);
    const st =
      admin || user.provider === 'anonymous' || user.provider == null
        ? { known: false }
        : await deps.status(user.uid, token);
    const d = accessDecision({
      provider: user.provider,
      isAdmin: admin,
      statusKnown: st.known,
      status: st.status ?? null,
    });
    if (!d.ok) return deny(d.code, d.error);
    const res = await context.next();
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'private, no-store'); // 别让共享缓存把它再发给没登录的人
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}

export const onRequest = makeGate({
  verify: verifyFirebaseToken,
  status: getUserStatus,
  admin: isAdmin,
});
