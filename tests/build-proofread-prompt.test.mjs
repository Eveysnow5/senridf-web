import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProofreadPrompt } from '../functions/api/_lib/buildProofreadPrompt.js';

test('含七类检查项与正文', () => {
  const p = buildProofreadPrompt('这是一段待校对的文稿。', '');
  for (const kw of [
    '一、错别字',
    '二、重复',
    '三、编辑',
    '四、事实与逻辑',
    '五、表述清晰',
    '六、论证完整',
    '七、标题',
  ]) {
    assert.match(p, new RegExp(kw));
  }
  assert.match(p, /这是一段待校对的文稿。/);
});

test('无参考资料时不含参考资料段', () => {
  const p = buildProofreadPrompt('正文', '');
  assert.doesNotMatch(p, /参考资料/);
});

test('有参考资料时含参考资料段与其内容，且四类里出现对照核查指令', () => {
  const p = buildProofreadPrompt('正文', '这是访谈记录原文。');
  assert.match(p, /参考资料/);
  assert.match(p, /这是访谈记录原文。/);
  assert.match(p, /断章取义|忠实于来源|矛盾/);
});

test('非字符串 reference 当作空、不抛错', () => {
  assert.doesNotThrow(() => buildProofreadPrompt('正文', null));
  assert.doesNotMatch(buildProofreadPrompt('正文', null), /参考资料/);
});

test('要求原文摘录原始连续片段（便于高亮定位）', () => {
  assert.match(buildProofreadPrompt('正文', ''), /连续片段|原始/);
});
