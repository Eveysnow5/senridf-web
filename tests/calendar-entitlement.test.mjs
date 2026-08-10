import assert from 'node:assert/strict';
import test from 'node:test';

import { getCalendarEntitlement } from '../functions/api/calendar/_entitlement.js';

const request = new Request('https://www.senridf.com/api/calendar', {
  headers: { Authorization: 'Bearer verified-firebase-token' },
});
const user = { uid: 'test-user-uid', email: 'user@example.com' };

function firestoreResponse(status, document) {
  return new Response(document === undefined ? null : JSON.stringify(document), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function userDocument(status) {
  return { fields: { status: { stringValue: status } } };
}

test('approved 用户允许访问 Calendar', async () => {
  const result = await getCalendarEntitlement({
    request,
    user,
    fetchImpl: async () => firestoreResponse(200, userDocument('approved')),
  });
  assert.deepEqual(result, { status: 'approved', enabled: true });
});

for (const status of ['pending', 'disabled']) {
  test(`${status} 用户拒绝访问 Calendar`, async () => {
    const result = await getCalendarEntitlement({
      request,
      user,
      fetchImpl: async () => firestoreResponse(200, userDocument(status)),
    });
    assert.deepEqual(result, { status, enabled: false });
  });
}

test('users/{uid} 不存在时拒绝访问 Calendar', async () => {
  const result = await getCalendarEntitlement({
    request,
    user,
    fetchImpl: async () => firestoreResponse(404),
  });
  assert.deepEqual(result, { status: null, enabled: false });
});

test('Firestore Rules 返回 403 时抛出权限查询错误', async () => {
  await assert.rejects(
    getCalendarEntitlement({
      request,
      user,
      fetchImpl: async () => firestoreResponse(403, { error: { message: 'PERMISSION_DENIED' } }),
    }),
    /Firestore entitlement lookup failed \(403\)/,
  );
});

test('Firestore 返回非法 JSON 时抛出明确错误', async () => {
  await assert.rejects(
    getCalendarEntitlement({
      request,
      user,
      fetchImpl: async () =>
        new Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    }),
    /Invalid Firestore entitlement response/,
  );
});

test('Firestore 文档结构异常时按未获授权处理', async () => {
  const result = await getCalendarEntitlement({
    request,
    user,
    fetchImpl: async () => firestoreResponse(200, { fields: { status: { booleanValue: true } } }),
  });
  assert.deepEqual(result, { status: null, enabled: false });
});
