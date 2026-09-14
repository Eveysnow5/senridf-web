// Auth + CORS + rate-limiting gate for every /api/* route.
// Cloudflare Pages runs this before any matched function under /api/.

import { verifyFirebaseToken } from './_lib/verifyFirebaseToken.js';
import { checkRateLimit } from './_lib/rateLimiter.js';
import { accessDecision } from './_lib/accessControl.js';
import { getUserStatus } from './_lib/userStatus.js';
import { isAdmin } from '../../js/shared/admins.js';

const ALLOWED_ORIGIN = 'https://www.senridf.com';

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (!allowed) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin) ?? {};

  // CORS preflight — must return before auth check (preflight has no token)
  if (request.method === 'OPTIONS') {
    if (!cors['Access-Control-Allow-Origin']) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers: cors });
  }

  // Auth check
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return json(401, { error: '未登录' }, cors);

  let user;
  try {
    user = await verifyFirebaseToken(token);
  } catch {
    return json(401, { error: '登录已过期或无效，请刷新页面重新登录' }, cors);
  }

  // ── 受発注デモの受控例外 ───────────────────────────────────────────────
  // この 1 ルートだけ「拒匿名」と「審核状態」を飛ばす（匿名で無料お試しさせるため）。
  // それでも token 検証（上）と限流（下）は通す。ほかの全端点は一切変わらない。
  // 匿名で呼べる代わりに、端点側で入力上限・固定プロンプト・独立鍵 DEMO_API_KEY・
  // 配額（匿名1/会員3/IP日次/全站500・日、fail-close）で厳しく縛る
  // （functions/api/demo-order-extract.js）。widening 防止に
  // tests/api-gate-centralized.test.mjs がこの例外の範囲を固定している。
  const isDemoRoute = new URL(request.url).pathname === '/api/demo-order-extract';

  // ── 匿名先挡（纯判断，零 IO）──────────────────────────────────────────────
  // 站点给每个访客都做了匿名登录，那张匿名 token 就在浏览器里。不挡的话任何人
  // 都能直接调烧钱的 AI 端点。这是主洞，无条件拒（demo 例外除外，见上）。
  // 管理员判断也需要 provider，所以先算 decision 的匿名分支：
  if (!isDemoRoute && (user.provider === 'anonymous' || user.provider == null)) {
    const d = accessDecision({ provider: user.provider });
    return json(d.code, { error: d.error }, cors);
  }

  // ── 限流（写 Firestore）放在状态检查之前 ──────────────────────────────────
  // 它把「未审核用户狂刷」也一并封顶在 120/次·分，包括下面那次状态读。
  // fail-close：限流器坏了就拦（护钱，见 rateLimiter.js 文件头）。
  //
  // demo 例外は限流をスキップする。理由：rate_limits の書き込みルールは isMember() を
  // 要求するので、**匿名**の書き込みは拒否→ fail-close で 429 になり、匿名がデモを
  // まったく使えなくなる。デモは端点側の配額（匿名1/会員3/IP日次/全站500・日）で縛るので
  // 共有限流器は不要（会員でも通算3回で頭打ち＝レート制限は実質意味がない）。
  if (!isDemoRoute) {
    const limited = await checkRateLimit(user.uid, token);
    if (limited) {
      return json(429, { error: '请求过于频繁，请稍后再试（每分钟限 120 次）' }, cors);
    }
  }

  // ── 审核状态（读 Firestore；管理员跳过）───────────────────────────────────
  // 前端只做界面显隐，真正的准入必须落在这里。读失败时 fail-open —— 理由见
  // accessControl.js 文件头（匿名已挡死 + 仍受限流，残余风险极小；fail-close 会
  // 让一次抖动关掉所有人所有工具）。
  // demo 例外：審核状態チェックも飛ばす（匿名/pending でもお試し可、端点側で配額）。
  if (!isDemoRoute) {
    const admin = isAdmin(user);
    let statusResult = { known: false };
    if (!admin) {
      statusResult = await getUserStatus(user.uid, token);
    }
    const decision = accessDecision({
      provider: user.provider,
      isAdmin: admin,
      statusKnown: statusResult.known,
      status: statusResult.status ?? null,
    });
    if (!decision.ok) {
      return json(decision.code, { error: decision.error }, cors);
    }
  }

  context.data.user = user;
  // 用量记录要用调用者的 ID token 写 Firestore（与限流同一套 REST 授权方式）
  context.data.idToken = token;

  // Attach CORS headers to the actual response
  const response = await context.next();
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
