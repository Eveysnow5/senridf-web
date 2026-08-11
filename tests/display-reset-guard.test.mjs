// 护栏：禁止新增 `style.display = ''` 的写法。
//
// 为什么
// `el.style.display = ''` 是**移除内联样式**，不是"恢复显示"。如果该元素在样式表里
// 被 `display:none` 匹配到（ID 规则优先级 100，类规则也够），移除内联样式后它继续
// 隐藏。这个 bug 在本仓库出现过两次：
//   2026-06-15  把内联样式挪进 CSS 清 linter 警告，加了
//               `#anPromptSection,#anActions,... { display:none }`，
//               而 JS 一直用 `''` 显示 → **文档分析工具彻底不可用，两个月无人发现**
//   2026-06-19  同一个 bug 在 translation.html 的 `#tabText` 上被修过一次，
//               但当时没有横扫其它文件，所以 analysis.html 一直坏着
//   同期        translation.html 的 `.voice-browser-warn`（类规则 display:none）
//               同样中招，浏览器不支持时用户看不到任何说明
//
// 正确写法二选一：
//   · `el.classList.toggle('is-hidden', 条件)` 配一个 `.is-hidden{display:none!important}`
//     —— 首选，不必知道元素原生 display 是什么（.an-actions 是 flex，
//     粗暴填 'block' 会让按钮竖排）
//   · 显式写值：`el.style.display = 'flex'` / `'block'`
//
// 这条护栏用「已审阅文件清单」而不是全面禁止：下面三个文件里的 `''` 已逐个查过
// 对应选择器没有 display:none 规则，是安全的。新出现的任何一处都会让这条测试
// 失败，强制去确认有没有可回落的 display:none——这正是当年没人做的那一步。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// 已逐个核查过、确认安全的既有用法（对应元素没有任何 display:none 规则可回落）。
// 新增条目前必须先确认这一点，并在此写明依据。
const REVIEWED = new Map([
  ['account.html', "#tool-list 无 display 规则，`''` 回落到默认 block"],
  ['solutions/blog/index.html', '.blog-empty 在 main.css 里无 display 属性'],
  ['solutions/demo/lifestory.html', '.btn-more 无 display 属性'],
  [
    'solutions/demo/translation.html',
    '#tlHistoryEmpty 无 display 规则；#tlPlaceholder 回落到 .tl-output-placeholder{display:flex}，本就该可见',
  ],
  // tools/document-analyzer 是纯本地免安装工具，不参与部署，不在扫描范围内
]);

// tests/ 排除：测试自己不操作 DOM，而这条护栏的说明文字里必然包含被禁的字样，
// 不排除就会自己抓自己。tools/ 是纯本地免安装工具，不参与部署。
const SKIP_DIRS = new Set(['node_modules', '.git', 'docs', 'tools', 'tests']);

// 只看真正的赋值语句：注释行、以及被反引号包起来的说明文字（改动说明里会引用这个
// 反面写法）都不算。第一版没做这个过滤，把 analysis.html 里解释 bug 的注释也判成了
// 违规——护栏本身也会误报，同样要验。
function hasRealAssignment(src) {
  return src.split('\n').some((line) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) {
      return false;
    }
    const code = line.replace(/`[^`]*`/g, ''); // 去掉反引号内的说明文字
    return /style\.display\s*=\s*(''|""|[^;]*\?\s*(''|"")\s*:)/.test(code);
  });
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(html|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test("没有未经审阅的 `style.display = ''` 写法", () => {
  const files = walk(ROOT);
  assert.ok(files.length >= 20, `只扫到 ${files.length} 个文件，扫描范围可能已失效`);

  const offenders = [];
  for (const full of files) {
    const src = readFileSync(full, 'utf8');
    if (!hasRealAssignment(src)) continue;
    const rel = relative(ROOT, full).replace(/\\/g, '/');
    if (!REVIEWED.has(rel)) offenders.push(rel);
  }

  assert.deepEqual(
    offenders,
    [],
    `这些文件用了 style.display = ''：${offenders.join(', ')}\n` +
      '先确认该元素有没有可回落的 display:none 规则。有 → 改用 classList；' +
      '没有 → 把文件加进 REVIEWED 并写明依据。',
  );
});

test('analysis.html 不再用 style.display 操作可见性（它是本 bug 的原发地）', () => {
  const src = readFileSync(join(ROOT, 'solutions/demo/analysis.html'), 'utf8');
  // 注释里出现该字样是允许的，只查真正的赋值语句
  const assignments = src.match(/^\s*el\w+\.style\.display\s*=/gm) || [];
  assert.deepEqual(
    assignments,
    [],
    `analysis.html 仍在用 style.display 赋值：${assignments.join(' / ')}`,
  );
});
