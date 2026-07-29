import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProbePrompt, parseProbeJson } from '../functions/api/_lib/lifestory-probe.js';

test('buildProbePrompt 含分析字段、追问指令、正文', () => {
  const p = buildProbePrompt('你在哪长大的？', '我在东北的一个小城长大。', [], []);
  assert.match(p, /tags/);
  assert.match(p, /isEvasion/);
  assert.match(p, /followup/);
  assert.match(p, /细节/);
  assert.match(p, /回避/);
  assert.match(p, /我在东北的一个小城长大。/);
  assert.match(p, /你在哪长大的？/);
});

test('buildProbePrompt 有历史时注入、无历史时不注入', () => {
  const withHist = buildProbePrompt('q', 'a', [{ question: '前一题', answer: '前一答' }], []);
  assert.match(withHist, /前一答/);
  const noHist = buildProbePrompt('q', 'a', [], []);
  assert.doesNotMatch(noHist, /最近的对话/);
});

test('buildProbePrompt 注入 knownTags', () => {
  assert.match(buildProbePrompt('q', 'a', [], ['startup', 'family']), /startup/);
});

test('parseProbeJson 正常扁平 JSON → {analysis, followup}', () => {
  const r = parseProbeJson(
    '{"tags":["startup"],"year":1990,"location":"东北","isEvasion":false,"evasionType":null,"softLanding":null,"followup":{"ask":true,"question":"那家店后来怎样了？"}}',
  );
  assert.deepEqual(r.analysis.tags, ['startup']);
  assert.equal(r.analysis.year, 1990);
  assert.equal(r.analysis.isEvasion, false);
  assert.equal(r.followup.ask, true);
  assert.equal(r.followup.question, '那家店后来怎样了？');
});

test('parseProbeJson 容忍 ```json 代码块', () => {
  const r = parseProbeJson('```json\n{"tags":[],"followup":{"ask":false,"question":""}}\n```');
  assert.equal(r.followup.ask, false);
});

test('parseProbeJson 坏 JSON → 安全默认（ask:false）', () => {
  const r = parseProbeJson('抱歉我无法完成');
  assert.deepEqual(r.analysis.tags, []);
  assert.equal(r.analysis.isEvasion, false);
  assert.equal(r.followup.ask, false);
  assert.equal(r.followup.question, '');
});

test('parseProbeJson 缺 followup 字段 → ask:false', () => {
  const r = parseProbeJson('{"tags":["x"],"isEvasion":true}');
  assert.equal(r.analysis.isEvasion, true);
  assert.equal(r.followup.ask, false);
});
