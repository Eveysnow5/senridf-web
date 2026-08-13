// 结构性护栏：**测试不许依赖 git 忽略的文件**。
//
// 2026-08-13 栽过一次：tests/eval-score.test.mjs 去 import `docs/eval/analysis-cases.json`，
// 而 `docs/` 是 gitignore 的（内部文档分离到私有仓库 senridoufuu-docs）。本地 `npm run
// check` 全绿 —— 因为文件就在我磁盘上；CI 一 checkout 就没有那个文件，import 直接抛错，
// 两次 workflow run 全红。
//
// 这类问题的形态是「本地绿 ≠ CI 绿」：它不改变代码对错，只改变"在哪台机器上能跑"，
// 而本地永远是能跑的那台。所以只能靠结构检查，不能靠跑一遍。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

/** 从源码里抠出所有相对路径引用（import 与 new URL 两种形态都要抓）。 */
function referencedPaths(file) {
  const src = readFileSync(file, 'utf8');
  const hits = [];
  for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) hits.push(m[1]);
  for (const m of src.matchAll(/new URL\(\s*['"](\.[^'"]+)['"]/g)) hits.push(m[1]);
  for (const m of src.matchAll(/readFileSync\(\s*['"]([^'"]+)['"]/g)) hits.push(m[1]);
  return hits.map((h) => resolve(dirname(file), h));
}

test('测试文件不许引用 git 忽略的路径（本地绿 ≠ CI 绿）', (t) => {
  // 判不了忽略状态时**显式 skip，不静默放行**。CI 上有 git 仓库所以照常跑；
  // 而从 git archive 导出的干净树里没有 .git，那时这条检查不适用——
  // 但"不适用"要看得见，不能装作通过（fail-open 是对的，静默不对）。
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT, stdio: 'pipe' });
  } catch {
    t.skip('不在 git 仓库里，无法判断忽略状态 —— 这条检查本次未生效');
    return;
  }

  const files = walk(join(ROOT, 'tests'));
  assert.ok(files.length >= 10, `只扫到 ${files.length} 个测试文件，扫描范围可能已失效`);

  const referenced = new Set();
  for (const f of files) {
    for (const p of referencedPaths(f)) {
      // 只关心仓库内的相对引用
      const rel = relative(ROOT, p);
      if (!rel.startsWith('..') && rel !== '') referenced.add(rel.split(sep).join('/'));
    }
  }
  assert.ok(referenced.size > 0, '一个引用都没抠出来，正则可能已失效');

  // git check-ignore 一次问多个路径，返回被忽略的那些
  let ignored = [];
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: ROOT,
      input: [...referenced].join('\n'),
      encoding: 'utf8',
    });
    ignored = out.split('\n').filter(Boolean);
  } catch (e) {
    // 一个都没被忽略时 git check-ignore 以 1 退出，这是正常情况
    if (e.status !== 1) throw e;
  }

  assert.deepEqual(
    ignored,
    [],
    `测试依赖了被 git 忽略的文件，CI 上它们不存在：\n  ${ignored.join('\n  ')}`,
  );
});
