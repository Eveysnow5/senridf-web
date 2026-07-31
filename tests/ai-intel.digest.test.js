const { test } = require('node:test');
const assert = require('node:assert');
const {
  buildDigestPrompt,
  validateDigestCitations,
} = require('../scripts/ai-intel-scraper/digest');

const items = [
  { title: '介護ロボA', summary_zh: '发布陪伴机器人 A。', theme: 'companion', url: 'https://x/1' },
  { title: 'AIチップB', summary_zh: '量产 AI 芯片 B。', theme: 'hardware', url: 'https://x/2' },
];

test('buildDigestPrompt：含周次、条目摘要与链接、防编造指令', () => {
  const p = buildDigestPrompt(items, '2026-W31');
  assert.match(p, /2026-W31/);
  assert.match(p, /发布陪伴机器人 A。/);
  assert.match(p, /https:\/\/x\/1/);
  assert.match(p, /只准归纳/);
});

test('validateDigestCitations：只引已入库链接 → ok', () => {
  const body = '## 陪伴\n- 机器人 A 发布（https://x/1）\n## 硬件\n- 芯片 B（https://x/2）';
  const r = validateDigestCitations(body, items);
  assert.equal(r.ok, true);
  assert.deepEqual(r.unknownUrls, []);
});

test('validateDigestCitations：出现库外链接 → 不 ok 并列出', () => {
  const body = '- 编造条目（https://evil/9）\n- 真条目（https://x/1）';
  const r = validateDigestCitations(body, items);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unknownUrls, ['https://evil/9']);
});

test('validateDigestCitations：无链接正文 → ok（没有编造 URL）', () => {
  const r = validateDigestCitations('本周无值得注意的动态。', items);
  assert.equal(r.ok, true);
});
