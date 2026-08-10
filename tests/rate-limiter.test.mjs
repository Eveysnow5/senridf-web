// /api/* 限流器的桶名生成测试。
//
// 存在的理由：2026-07-01～08-10 这段时间限流完全没生效，因为 transform.document
// 传的是完整 https:// URL 而不是资源名，Firestore 每次回 400，又被静默吞掉。
// 六周无人察觉。下面第一条断言就是专门钉住那个 bug 的。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimitDocName } from '../functions/api/_lib/rateLimiter.js';

const UID = 'abc123XYZ';
const T = new Date('2026-08-10T00:45:12.179Z');

test('桶名是资源名，不是 URL（回归：lacks "projects" at index 0）', () => {
  const name = rateLimitDocName(UID, T);
  assert.ok(name.startsWith('projects/'), `必须以 projects/ 开头，实际：${name}`);
  assert.ok(!name.includes('https://'), `不能含 https://，实际：${name}`);
  assert.ok(!name.includes('/v1/'), `不能含 API 版本段，实际：${name}`);
});

test('桶名包含 uid 和分钟，落在 rate_limits 集合下', () => {
  assert.equal(
    rateLimitDocName(UID, T),
    'projects/senridfauthentication/databases/(default)/documents/rate_limits/abc123XYZ_202608100045',
  );
});

test('uid 在下划线前——Firestore 规则靠 split("_")[0] 判归属', () => {
  const docId = rateLimitDocName(UID, T).split('/').pop();
  assert.equal(docId.split('_')[0], UID);
});

test('同一分钟内桶名稳定，跨分钟换桶', () => {
  const same = new Date('2026-08-10T00:45:59.999Z');
  const next = new Date('2026-08-10T00:46:00.000Z');
  assert.equal(rateLimitDocName(UID, T), rateLimitDocName(UID, same));
  assert.notEqual(rateLimitDocName(UID, T), rateLimitDocName(UID, next));
});
