#!/usr/bin/env node
// 评估基线的报告生成器。**手动跑，不进 `npm run check`。**
//
// 用法：
//   1. 在真工具里逐条跑 docs/eval/analysis-cases.json 里的用例（题目和文件都在里面）
//   2. 把每条的回答原文存成 <answers-dir>/<case-id>.md
//      可选：同名 .meta.json 里记 {"rounds": 3, "seconds": 92}
//   3. node scripts/eval/run-analysis-eval.mjs <answers-dir> [报告输出路径]
//
// 为什么不自动跑：整条流水线（pdf.js 抽取、canvas 渲染、多轮循环）都在浏览器里，
// Node 复刻不了。在 Node 里重实现一份，测的就不是生产路径——这个项目已经在
// 「用非生产工具代替测量」上栽过两次。宁可跑得笨，也别量错东西。
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { scoreCase, summarize } from './score.mjs';

const [, , answersDir, outPath] = process.argv;
if (!answersDir) {
  console.error('用法: node scripts/eval/run-analysis-eval.mjs <answers-dir> [out.md]');
  console.error('  answers-dir 里每个用例一个 <case-id>.md（回答原文）');
  process.exit(1);
}

const cfg = JSON.parse(readFileSync('docs/eval/analysis-cases.json', 'utf8'));
const results = [];
const missing = [];
const meta = new Map();

for (const c of cfg.cases) {
  const p = join(answersDir, `${c.id}.md`);
  if (!existsSync(p)) {
    missing.push(c.id);
    continue;
  }
  const answer = readFileSync(p, 'utf8');
  results.push(scoreCase(c, answer));
  const mp = join(answersDir, `${c.id}.meta.json`);
  if (existsSync(mp)) meta.set(c.id, JSON.parse(readFileSync(mp, 'utf8')));
}

if (results.length === 0) {
  console.error(
    `${answersDir} 里一个用例回答都没有。目录内容：${readdirSync(answersDir).join(', ')}`,
  );
  process.exit(1);
}

const s = summarize(results);
const rounds = [...meta.values()]
  .map((m) => m.rounds)
  .filter(Number.isFinite)
  .sort((a, b) => a - b);
const medianRounds = rounds.length ? rounds[Math.floor(rounds.length / 2)] : null;

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`);
const lines = [
  `# 文书分析评估报告 — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `回答目录：\`${answersDir}\``,
  '',
  '## 汇总',
  '',
  '| 指标 | 值 |',
  '|---|---|',
  `| 用例数 | ${s.total}${missing.length ? `（另有 ${missing.length} 条没跑：${missing.join(', ')}）` : ''} |`,
  `| 自动判通过 | ${s.pass} / ${s.pass + s.fail}（${pct(s.autoRate)}） |`,
  `| 待人工判 | ${s.manual} |`,
  `| **引用正确率** | ${pct(s.citationRate)} |`,
  `| 轮数中位数 | ${medianRounds ?? '—'} |`,
  '',
  '> 引用正确率单独看：**答对但引错页说明它是蒙的**。',
  '> 轮数中位数是判断「章节树索引值不值得做」的唯一依据。',
  '> manual 不计入通过率——把"没判"混进分数里，分数就没意义了。',
  '',
  '## 逐条',
  '',
];

for (const r of results) {
  const c = cfg.cases.find((x) => x.id === r.id);
  const mark = { pass: '✅', fail: '❌', manual: '🧑' }[r.verdict];
  const m = meta.get(r.id);
  lines.push(
    `### ${mark} ${r.id}`,
    '',
    `**守什么：** ${c.category}`,
    m ? `**轮数 ${m.rounds ?? '—'} · 耗时 ${m.seconds ?? '—'}s**` : '',
    '',
  );
  for (const k of r.checks) {
    lines.push(`- ${k.ok ? '✓' : '✗'} ${k.name}${k.note ? `（${k.note}）` : ''}`);
  }
  if (r.verdict === 'manual') {
    lines.push('', '**需要人工判定：**');
    for (const crit of c.expect.manualCriteria || []) lines.push(`- ${crit}`);
  }
  lines.push('');
}

if (missing.length) {
  lines.push('## 没跑的用例', '', ...missing.map((id) => `- ${id}`), '');
}

const report = lines.filter((l) => l !== undefined).join('\n');
if (outPath) {
  writeFileSync(outPath, report);
  console.log(`报告已写入 ${outPath}`);
} else {
  console.log(report);
}

// 退出码只反映**自动判**的失败。manual 不影响退出码——它等的是人，不是机器。
process.exit(s.fail > 0 ? 1 : 0);
