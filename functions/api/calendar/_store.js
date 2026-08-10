const FIRESTORE_PROJECT = 'senridfauthentication';
const FIRESTORE_BASE =
  `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}` +
  '/databases/(default)/documents';

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function valueToFirestore(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(valueToFirestore) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: objectToFirestore(value) } };
  }
  throw new Error('Unsupported Calendar value');
}

function objectToFirestore(object) {
  return Object.fromEntries(
    Object.entries(object)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, valueToFirestore(value)]),
  );
}

function valueFromFirestore(value) {
  if (!value || 'nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(valueFromFirestore);
  if ('mapValue' in value) return objectFromFirestore(value.mapValue.fields || {});
  throw new Error('Invalid Calendar Firestore value');
}

function objectFromFirestore(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, valueFromFirestore(value)]),
  );
}

function calendarCollection(uid, name) {
  return `${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}/${name}`;
}

function credentials(request, user) {
  const token = bearerToken(request);
  if (!user?.uid || !token) throw new Error('Missing verified Calendar credentials');
  return { token, uid: user.uid };
}

async function firestoreJson(response, action) {
  if (!response.ok) throw new Error(`Calendar Firestore ${action} failed (${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new Error(`Invalid Calendar Firestore ${action} response`);
  }
}

export async function listCalendarDocuments({ request, user, collection, fetchImpl = fetch }) {
  const { token, uid } = credentials(request, user);
  const response = await fetchImpl(`${calendarCollection(uid, collection)}?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return [];
  const data = await firestoreJson(response, 'list');
  return (data.documents || []).map((document) => ({
    id: document.name.split('/').pop(),
    ...objectFromFirestore(document.fields),
  }));
}

export async function getCalendarDocument({ request, user, collection, id, fetchImpl = fetch }) {
  const { token, uid } = credentials(request, user);
  const response = await fetchImpl(
    `${calendarCollection(uid, collection)}/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 404) return null;
  const document = await firestoreJson(response, 'read');
  return { id, ...objectFromFirestore(document.fields) };
}

export async function saveCalendarDocument({
  request,
  user,
  collection,
  id = crypto.randomUUID(),
  value,
  fetchImpl = fetch,
}) {
  const { token, uid } = credentials(request, user);
  const response = await fetchImpl(
    `${calendarCollection(uid, collection)}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: objectToFirestore(value) }),
    },
  );
  await firestoreJson(response, 'write');
  return { id, ...value };
}
