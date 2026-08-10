import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteCalendarDocument,
  getCalendarDocument,
  listCalendarDocuments,
  saveCalendarDocument,
} from '../functions/api/calendar/_store.js';

const request = new Request('https://www.senridf.com/api/calendar/schedule', {
  headers: { Authorization: 'Bearer verified-token' },
});
const user = { uid: 'user-a' };

function response(status, body = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('保存路径只使用已验证用户的 uid', async () => {
  let requestedUrl;
  let requestedBody;
  const saved = await saveCalendarDocument({
    request,
    user,
    collection: 'calendarRules',
    id: 'rule-1',
    value: { title: '日语课', active: true, weekdays: [1, 2, 3, 4, 5] },
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      return response(200, { name: 'rule-1' });
    },
  });
  assert.match(requestedUrl, /\/users\/user-a\/calendarRules\/rule-1$/);
  assert.equal(requestedBody.fields.title.stringValue, '日语课');
  assert.equal(requestedBody.fields.active.booleanValue, true);
  assert.deepEqual(saved.weekdays, [1, 2, 3, 4, 5]);
});

test('客户端无法通过内容伪造另一个 uid 的保存路径', async () => {
  let requestedUrl;
  await saveCalendarDocument({
    request,
    user,
    collection: 'calendarRules',
    id: 'rule-2',
    value: { uid: 'attacker', title: '课程' },
    fetchImpl: async (url) => {
      requestedUrl = url;
      return response(200, {});
    },
  });
  assert.match(requestedUrl, /\/users\/user-a\//);
  assert.doesNotMatch(requestedUrl, /attacker/);
});

test('读取列表可以还原嵌套的重复规则', async () => {
  const rules = await listCalendarDocuments({
    request,
    user,
    collection: 'calendarRules',
    fetchImpl: async () =>
      response(200, {
        documents: [
          {
            name: 'projects/x/databases/(default)/documents/users/user-a/calendarRules/rule-1',
            fields: {
              title: { stringValue: '日语课' },
              recurrence: {
                mapValue: {
                  fields: {
                    weekdays: {
                      arrayValue: { values: [{ integerValue: '1' }, { integerValue: '2' }] },
                    },
                  },
                },
              },
            },
          },
        ],
      }),
  });
  assert.deepEqual(rules, [{ id: 'rule-1', title: '日语课', recurrence: { weekdays: [1, 2] } }]);
});

test('读取不存在的规则返回 null，不能建立悬空例外', async () => {
  const rule = await getCalendarDocument({
    request,
    user,
    collection: 'calendarRules',
    id: 'missing',
    fetchImpl: async () => response(404),
  });
  assert.equal(rule, null);
});

test('Firestore 拒绝写入时明确失败', async () => {
  await assert.rejects(
    () =>
      saveCalendarDocument({
        request,
        user,
        collection: 'calendarExceptions',
        id: 'exception-1',
        value: { ruleId: 'rule-1' },
        fetchImpl: async () => response(403),
      }),
    /write failed \(403\)/,
  );
});

test('删除路径只使用已验证用户的 uid', async () => {
  let requestedUrl;
  let requestedMethod;
  await deleteCalendarDocument({
    request,
    user,
    collection: 'calendarRules',
    id: 'rule-1',
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedMethod = options.method;
      return new Response(null, { status: 200 });
    },
  });
  assert.match(requestedUrl, /\/users\/user-a\/calendarRules\/rule-1$/);
  assert.equal(requestedMethod, 'DELETE');
});
