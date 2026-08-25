import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// GitHub Actions 会把 `${{ … }}` 在**生成 shell 脚本之前**替换成字面文本。
// 所以只要用户可控的值出现在 `run:` 里，它的内容就会被当作命令的一部分解析 ——
// 加了引号也没用，输入里有引号或换行就能跳出去。
//
// 2026-08-25 实测撞到：作者误把上一次的整段运行日志粘进了 workflow 的
// 「周次」输入框，那段文本直接把命令撑爆（`punycode: command not found`、
// 一堆 `No such file or directory`、最后 `exit 127`）——
// **脚本自己的格式校验根本没机会跑到**。
//
// 正确做法：用 env: 传值，run 里只引用 "$VAR"。变量的内容永远不会被当成命令。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WF_DIR = path.join(ROOT, '.github', 'workflows');

const FILES = readdirSync(WF_DIR)
  .filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'))
  .map((n) => ({ name: n, src: readFileSync(path.join(WF_DIR, n), 'utf8') }));

test('护栏自身有效：扫到了 workflow', () => {
  assert.ok(FILES.length >= 4, `只扫到 ${FILES.length} 个 workflow`);
});

/**
 * 取出每个 `run:` 的正文。
 *
 * ⚠️ 两种写法都要认。首版只认 `run: |` 的多行块，于是单行的
 * `run: npm install` 全部漏掉 —— 而单行同样能被注入。
 * **护栏第一版又只覆盖了作者当时想到的那一种形态**（这仓库里这已经是第四次了）。
 */
function runBlocks(src) {
  const lines = src.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    // `- run:` 是最常见的写法之一（ci.yml 全是），首版正则要求 run: 前只能是空白，
    // 破折号直接把它挡在外面 —— 同一个"只覆盖想到的那一种形态"的坑，一天之内第三次。
    const block = lines[i].match(/^(\s*(?:-\s+)?)run:\s*[|>]/);
    if (block) {
      const indent = block[1].length;
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim() && line.search(/\S/) <= indent) break;
        body.push({ line, no: j + 1 });
      }
      blocks.push(body);
      continue;
    }
    // 单行形式：run: 后面直接跟命令
    const inline = lines[i].match(/^\s*(?:-\s+)?run:\s+(?![|>]\s*$)(.+)$/);
    if (inline) blocks.push([{ line: inline[1], no: i + 1 }]);
  }
  return blocks;
}

test('护栏自身有效：三种写法的 run 都取得到', () => {
  const total = FILES.reduce((n, f) => n + runBlocks(f.src).length, 0);
  // 下限取 10：坏掉的首版只取到 5，现在是 11。留一格余量，但要远高于 5。
  assert.ok(total >= 10, `只取到 ${total} 个 run，块解析多半又漏了某种写法`);
  // ci.yml 全是 `- run: xxx` 的列表项形式；首版正则要求 run: 前只能是空白，
  // 破折号直接把它挡在外面，于是那个文件一行都没被检查。
  const ci = FILES.find((f) => f.name === 'ci.yml');
  assert.ok(ci, '找不到 ci.yml');
  assert.ok(runBlocks(ci.src).length >= 2, 'ci.yml 的 `- run:` 没被取到');
});

// 只禁**用户可控**的来源。secrets 与 github.* 里的固定字段不是攻击面，
// 而且 secrets 本来就该走 env（这仓库已经这么做了）。
const UNSAFE =
  /\$\{\{\s*(inputs|github\.event\.(inputs|issue|pull_request|comment)|env\.GITHUB_HEAD_REF)/;

test('★ run: 里不出现用户可控的输入 —— 那是脚本注入', () => {
  const bad = [];
  for (const { name, src } of FILES) {
    for (const body of runBlocks(src)) {
      for (const { line, no } of body) {
        if (UNSAFE.test(line)) bad.push(`${name}:${no}  ${line.trim().slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `这些地方把用户输入插进了 shell 脚本，应改成 env: 传值再引用 "$VAR"：\n${bad.join('\n')}`,
  );
});

// 护栏的护栏：正则得真认得出那种写法。
// 不做这步的话，正则哪天被改坏会永远绿 —— 而这条护栏本身没有别的信号。
test('护栏自身有效：正则认得出注入写法', () => {
  for (const s of [
    '            --weeks "${{ inputs.weeks }}" \\',
    "  node x.js ${{ inputs.apply && '--apply' || '' }}",
    '  echo ${{ github.event.inputs.name }}',
    '  git checkout ${{ env.GITHUB_HEAD_REF }}',
  ]) {
    assert.ok(UNSAFE.test(s), `认不出：${s}`);
  }
  // 这些是安全的，不该误报
  for (const s of [
    '  node x.js --weeks "$WEEKS"',
    '          QWEN_API_KEY: ${{ secrets.QWEN_API_KEY }}',
    "    if: github.repository == 'sherlockafa007/senridoufuu-web'",
  ]) {
    assert.ok(!UNSAFE.test(s), `误报：${s}`);
  }
});

// 两个会烧额度的 workflow：真跑必须是显式选择，默认永远是预演。
test('会烧额度的 workflow，apply 的默认值必须是 false', () => {
  for (const n of ['rebuild-ai-intel-digest.yml', 'backfill-bid-summaries.yml']) {
    const src = FILES.find((f) => f.name === n)?.src;
    assert.ok(src, `找不到 ${n}`);
    assert.match(src, /apply:[\s\S]{0,200}?default: false/, `${n} 的 apply 默认值不是 false`);
    assert.doesNotMatch(src, /^\s*schedule:/m, `${n} 不该有定时 —— 它会烧额度`);
  }
});
