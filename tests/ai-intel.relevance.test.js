const { test } = require('node:test');
const assert = require('node:assert');
const {
  THEMES,
  buildJudgmentPrompt,
  parseJudgment,
} = require('../scripts/ai-intel-scraper/relevance');

test('THEMES 是三主题白名单', () => {
  assert.deepEqual(THEMES, ['companion', 'hardware', 'policy']);
});

test('buildJudgmentPrompt：含标题、三主题定义、JSON 输出指令', () => {
  const p = buildJudgmentPrompt({ title: '介護ロボット発表', url: 'https://x/1' });
  assert.match(p, /介護ロボット発表/);
  assert.match(p, /companion/);
  assert.match(p, /hardware/);
  assert.match(p, /policy/);
  assert.match(p, /JSON/);
});

test('parseJudgment：正常 keep=true 解析出 theme/summary', () => {
  const r = parseJudgment(
    '{"keep":true,"theme":"companion","summary_zh":"某公司发布陪伴机器人。"}',
  );
  assert.equal(r.keep, true);
  assert.equal(r.theme, 'companion');
  assert.equal(r.summary_zh, '某公司发布陪伴机器人。');
  assert.deepEqual(r.key_facts, []);
});

test('parseJudgment：带 ```json 代码块也能解析', () => {
  const r = parseJudgment(
    '```json\n{"keep":true,"theme":"hardware","summary_zh":"AI 芯片量产。"}\n```',
  );
  assert.equal(r.keep, true);
  assert.equal(r.theme, 'hardware');
});

test('parseJudgment：keep=false → reason filtered_out', () => {
  const r = parseJudgment('{"keep":false,"reason":"不属于三主题"}');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'filtered_out');
});

test('parseJudgment：坏 JSON → reason bad_json、keep=false', () => {
  const r = parseJudgment('这不是 JSON');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'bad_json');
});

test('parseJudgment：theme 不在白名单 → bad_json', () => {
  const r = parseJudgment('{"keep":true,"theme":"education","summary_zh":"x"}');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'bad_json');
});

test('parseJudgment：keep=true 但 summary 空 → bad_json', () => {
  const r = parseJudgment('{"keep":true,"theme":"policy","summary_zh":"   "}');
  assert.equal(r.keep, false);
  assert.equal(r.reason, 'bad_json');
});

test('parseJudgment：key_facts 只保留字符串项', () => {
  const r = parseJudgment(
    '{"keep":true,"theme":"policy","summary_zh":"x","key_facts":["a",1,null,"b"]}',
  );
  assert.deepEqual(r.key_facts, ['a', 'b']);
});
