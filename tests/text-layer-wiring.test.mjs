import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 结构护栏。text-layer.js 本身有行为测试，但**模块算对了不等于页面用上了**——
// 2026-08-10 就栽过一次同型：集中化之后筛选条件不再命中，护栏永远绿而什么都没测。
// 这里守的是 analysis.html 里的三处接线。
const HTML = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'solutions',
    'demo',
    'analysis.html',
  ),
  'utf8',
);

test('护栏自身有效：读到了 analysis.html 且含多轮取页的关键结构', () => {
  assert.ok(HTML.length > 50000, `只读到 ${HTML.length} 字符`);
  assert.match(HTML, /sdfRenderFindResults/);
});

test('text-layer 被 import 并挂上 window 桥（内联 script 只能这样拿到它）', () => {
  assert.match(HTML, /import \{[^}]*assessTextLayer[^}]*\} from '\/js\/shared\/text-layer\.js'/);
  assert.match(HTML, /window\.sdfAssessTextLayer = assessTextLayer/);
  assert.match(HTML, /window\.sdfDescribeTextLayer = describeTextLayer/);
});

test('文件抬头带上文字层说明', () => {
  assert.match(HTML, /sdfDescribeTextLayer\(assessments\[i\]\)/);
});

// 这条是本次改动的要害：扫描件上的"全文未命中"必须带尾注，否则模型据此断定"文件里没有"。
test('FIND 回执传入了该文件的体检结果', () => {
  assert.match(HTML, /sdfRenderFindResults\([^)]*assessments\[fi - 1\]\)/);
});
