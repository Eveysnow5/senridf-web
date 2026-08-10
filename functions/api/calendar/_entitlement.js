const FIRESTORE_PROJECT = 'senridfauthentication';
const FIRESTORE_DOCUMENTS =
  `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}` +
  '/databases/(default)/documents';

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export function readUserEntitlement(document) {
  const fields = document?.fields || {};
  return {
    status: fields.status?.stringValue || null,
  };
}

export async function getCalendarEntitlement({ request, user, fetchImpl = fetch }) {
  // `user` is populated by /api/_middleware.js after Firebase token verification.
  // Never accept a uid from the URL, query string, or request body.
  if (!user?.uid) throw new Error('Missing verified Firebase uid');

  const token = bearerToken(request);
  if (!token) throw new Error('Missing verified Firebase token');

  const response = await fetchImpl(`${FIRESTORE_DOCUMENTS}/users/${encodeURIComponent(user.uid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) {
    return { enabled: false, status: null };
  }
  if (!response.ok) {
    throw new Error(`Firestore entitlement lookup failed (${response.status})`);
  }

  let document;
  try {
    document = await response.json();
  } catch {
    throw new Error('Invalid Firestore entitlement response');
  }

  const entitlement = readUserEntitlement(document);
  return {
    ...entitlement,
    // Phase 1 reuses the existing membership approval as Calendar access.
    // Additional feature/subscription entitlement checks can be composed here later.
    enabled: entitlement.status === 'approved',
  };
}
