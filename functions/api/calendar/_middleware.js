// Calendar-specific authorization gate. Cloudflare Pages runs this middleware
// after /api/_middleware.js, so context.data.user is already backed by a verified
// Firebase ID token. Every current and future /api/calendar/* route inherits it.
import { getCalendarEntitlement } from './_entitlement.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequest(context) {
  const user = context.data.user;
  let entitlement;
  try {
    entitlement = await getCalendarEntitlement({ request: context.request, user });
  } catch (error) {
    console.error('[calendar entitlement]', error);
    return json(502, { error: '暂时无法验证 Calendar 权限，请稍后重试' });
  }

  if (!entitlement.enabled) {
    return json(403, { error: '当前账号尚未通过会员审核' });
  }

  context.data.calendarUser = {
    uid: user.uid,
    email: user.email,
  };
  context.data.calendarAccess = {
    granted: true,
    basis: 'approved-membership',
  };

  return context.next();
}
