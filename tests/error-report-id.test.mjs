import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorFingerprint, errorDocId, normalizeError } from '../js/shared/error-report-id.js';

test('errorFingerprint：同一错误产同指纹', () => {
  const a = errorFingerprint({ type: 'js', message: 'x is not defined', source: 'a.js', line: 10 });
  const b = errorFingerprint({ type: 'js', message: 'x is not defined', source: 'a.js', line: 10 });
  assert.equal(a, b);
});

test('errorFingerprint：消息里的动态数字被归一化后仍同指纹', () => {
  const a = errorFingerprint({
    type: 'js',
    message: 'timeout after 3000ms',
    source: 'a.js',
    line: 1,
  });
  const b = errorFingerprint({
    type: 'js',
    message: 'timeout after 5000ms',
    source: 'a.js',
    line: 1,
  });
  assert.equal(a, b);
});

test('errorFingerprint：不同错误产不同指纹', () => {
  const a = errorFingerprint({ type: 'js', message: 'x is not defined', source: 'a.js', line: 10 });
  const b = errorFingerprint({
    type: 'js',
    message: 'y is not a function',
    source: 'b.js',
    line: 20,
  });
  assert.notEqual(a, b);
});

test('errorFingerprint：指纹以类型开头，便于肉眼分辨', () => {
  const fp = errorFingerprint({ type: 'csp', message: 'script-src', source: '', line: null });
  assert.ok(fp.startsWith('csp-'));
});

test('errorDocId：格式为 指纹_YYYY-MM-DD', () => {
  const id = errorDocId('js-abc', new Date('2026-07-27T10:00:00Z'));
  assert.equal(id, 'js-abc_2026-07-27');
});

test('errorDocId：跨天产不同ID', () => {
  assert.notEqual(
    errorDocId('js-abc', new Date('2026-07-27T23:59:59Z')),
    errorDocId('js-abc', new Date('2026-07-28T00:00:01Z')),
  );
});

test('normalizeError：js 事件抽取 message/filename/lineno/colno', () => {
  const r = normalizeError('js', { message: 'boom', filename: 'a.js', lineno: 12, colno: 3 });
  assert.equal(r.type, 'js');
  assert.equal(r.message, 'boom');
  assert.equal(r.source, 'a.js');
  assert.equal(r.line, 12);
  assert.equal(r.col, 3);
});

test('normalizeError：js 资源加载失败标记为 resource 类型', () => {
  const r = normalizeError('js', { message: '', target: { tagName: 'IMG', src: '/x.png' } });
  assert.equal(r.type, 'resource');
  assert.equal(r.source, '/x.png');
});

test('normalizeError：promise 从 reason.message 取消息', () => {
  const r = normalizeError('promise', { reason: { message: 'rejected!' } });
  assert.equal(r.type, 'promise');
  assert.equal(r.message, 'rejected!');
});

test('normalizeError：promise reason 为字符串时也能取', () => {
  const r = normalizeError('promise', { reason: 'plain string reason' });
  assert.equal(r.message, 'plain string reason');
});

test('normalizeError：csp 抽取 violatedDirective/blockedURI/disposition', () => {
  const r = normalizeError('csp', {
    violatedDirective: 'script-src',
    blockedURI: 'https://evil.com/x.js',
    disposition: 'report',
    sourceFile: 'page.html',
    lineNumber: 5,
  });
  assert.equal(r.type, 'csp');
  assert.equal(r.message, 'script-src');
  assert.equal(r.extra.blockedURI, 'https://evil.com/x.js');
  assert.equal(r.extra.disposition, 'report');
});
