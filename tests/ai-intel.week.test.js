const { test } = require('node:test');
const assert = require('node:assert');
const { isoWeek } = require('../scripts/ai-intel-scraper/week');

test('isoWeek：2026-01-01（周四）属于 2026-W01', () => {
  assert.equal(isoWeek(new Date(2026, 0, 1)), '2026-W01');
});

test('isoWeek：跨年周归属正确——2025-12-29（周一）属于 2026-W01', () => {
  assert.equal(isoWeek(new Date(2025, 11, 29)), '2026-W01');
});

test('isoWeek：2026-07-31（周五）属于 2026-W31', () => {
  assert.equal(isoWeek(new Date(2026, 6, 31)), '2026-W31');
});

test('isoWeek：周数补零到两位', () => {
  assert.match(isoWeek(new Date(2026, 0, 5)), /^2026-W\d{2}$/);
});
