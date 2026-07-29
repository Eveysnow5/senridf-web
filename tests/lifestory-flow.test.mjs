import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideProbe } from '../js/shared/lifestory-flow.js';

const ask = (q = '再说说？') => ({ followup: { ask: true, question: q } });

test('ask=true 且未达上限 → ask', () => {
  assert.equal(decideProbe(ask(), 0, 2), 'ask');
  assert.equal(decideProbe(ask(), 1, 2), 'ask');
});

test('ask=true 但已达上限 → advance', () => {
  assert.equal(decideProbe(ask(), 2, 2), 'advance');
  assert.equal(decideProbe(ask(), 3, 2), 'advance');
});

test('ask=false → advance', () => {
  assert.equal(decideProbe({ followup: { ask: false, question: '' } }, 0, 2), 'advance');
});

test('followup.question 为空 → advance（即使 ask 为真）', () => {
  assert.equal(decideProbe({ followup: { ask: true, question: '  ' } }, 0, 2), 'advance');
});

test('缺 followup / 非对象 → advance（容错）', () => {
  assert.equal(decideProbe({}, 0, 2), 'advance');
  assert.equal(decideProbe(null, 0, 2), 'advance');
});
