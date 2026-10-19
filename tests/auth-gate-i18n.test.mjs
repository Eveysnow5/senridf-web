import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 登录门控的三语（2026-10-19）：原来跳登录页时不带 ?lang=，带英文参数的链接点进工具页，
// 没登录的新访客看到日文登录页；审核中/停用/出错的提示只有中文。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'js', 'shared', 'auth-gate.js'), 'utf8');

test('未登录跳登录页时带上 URL 里的语言（不是写死 /account.html）', () => {
  assert.match(SRC, /window\.location\.replace\(accountUrl\(\)\)/);
  assert.doesNotMatch(SRC, /location\.replace\('\/account\.html'\)/);
  assert.match(SRC, /`\/account\.html\?lang=\$\{p\}`/);
});

test('审核中/停用/出错的提示三语齐全，且各语言的状态键一致', () => {
  const block = SRC.slice(SRC.indexOf('const MESSAGES = {'), SRC.indexOf('const msg ='));
  for (const lang of ['ja', 'zh', 'en'])
    assert.match(block, new RegExp(`\n  ${lang}: [{]`), `缺 ${lang}`);
  for (const state of ['pending', 'disabled', 'error']) {
    assert.equal(
      (block.match(new RegExp(`\n    ${state}: [{]`, 'g')) || []).length,
      3,
      `${state} 不是三语各一条`,
    );
  }
  assert.doesNotMatch(SRC, /MESSAGES\.(pending|disabled|error)/, '直接取 MESSAGES.x 会绕过语言');
});

// 同传工具的会议纪要 docx：浏览器版是 build/index.umd.js（提供 window.docx）。
// 2026-07-16 钉版本时写成了 build/index.js——那个文件在 CDN 上是 404，下载会议纪要一直失败，
// 所有本地检查全绿（SRI/版本/映射都在，只是文件不存在）。
test('同传页加载的 docx 是 UMD 版（index.js 在 CDN 上不存在）', () => {
  const html = readFileSync(path.join(ROOT, 'solutions', 'demo', 'translation.html'), 'utf8');
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/docx@[\d.]+\/build\/index\.umd\.js/);
  assert.doesNotMatch(html, /docx@[\d.]+\/build\/index\.js"/);
});
