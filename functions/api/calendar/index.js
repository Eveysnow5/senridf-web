function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// Phase 0 session endpoint. Firebase authentication and Calendar entitlement are
// enforced by the two parent middleware layers before this handler runs.
export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  return json(200, {
    ok: true,
    user: context.data.calendarUser,
    accessGranted: context.data.calendarAccess.granted,
    accessBasis: context.data.calendarAccess.basis,
    capabilities: {
      calendarRead: true,
      calendarWrite: true,
      aiAssistant: true,
      recurringSchedules: true,
      scheduleExceptions: true,
    },
  });
}
