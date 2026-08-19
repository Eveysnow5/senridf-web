import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 2026-08-19：查 CSP 时发现 admin 的镜像轮询用 `catch { /* 网络抖动 */ }` 把
// "被浏览器拦下"和"服务器还没准备好"吞成了同一件事，结果是转满五分钟给一句
// 不含信息的提示。顺手盘了全站，15 处静默 catch 里多数是合理的
// （res.json() 解析失败退回状态码、SSE 丢弃畸形分块——这些 error 本身不带额外
// 信息），但有三处把唯一的诊断线索吞掉了。
//
// 这个文件不试图判断"该不该吞"——那要看语义，静态判不了。它只守两条：
//   1. 完全空的 `catch {}` 不允许存在：吞可以，但必须写下为什么。
//   2. 那三处修好的地方不许退回去。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP = new Set(['node_modules', '.git', 'docs', 'tools', 'fixtures', 'tests']);
function browserFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('__')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) browserFiles(p, acc);
    else if (/\.(html|js|mjs)$/.test(name)) acc.push(p);
  }
  return acc;
}
const FILES = browserFiles(ROOT);

test('护栏自身有效：扫到了文件', () => {
  assert.ok(FILES.length >= 40, `只扫到 ${FILES.length} 个文件`);
});

// 只匹配**一层**花括号内没有任何内容的 catch —— 连注释都没有的那种。
const EMPTY_CATCH = /catch\s*(?:\(\s*\w*\s*\))?\s*\{\s*\}/g;

test('没有完全空的 catch —— 吞异常可以，但必须写下为什么', () => {
  const bad = [];
  for (const p of FILES) {
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(EMPTY_CATCH)) {
      const line = src.slice(0, m.index).split('\n').length;
      bad.push(`${path.relative(ROOT, p).split(path.sep).join('/')}:${line}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    `这些 catch 一个字都没留下，出问题时无从判断是被吞了还是没发生：\n${bad.join('\n')}`,
  );
});

// 护栏的护栏：确认上面那条正则真的认得出空 catch。
// 不做这步的话，正则哪天被改坏（比如 \s* 掉了），它会永远绿。
test('护栏自身有效：正则确实能识别空 catch', () => {
  for (const s of ['try{}catch{}', 'try{}catch (e){}', 'try{}catch(err) {   }']) {
    assert.match(s, new RegExp(EMPTY_CATCH.source), `认不出：${s}`);
  }
  // 带注释的不算空
  assert.doesNotMatch('try{}catch{ /* 说明 */ }', new RegExp(EMPTY_CATCH.source));
});

test('草稿自动保存的失败会被作者看见（原先成败都没有任何提示）', () => {
  const s = readFileSync(path.join(ROOT, 'admin', 'blog', 'index.html'), 'utf8');
  assert.match(s, /id="draft-status"/, '少了显示草稿状态的元素');
  // 断言要贴住"失败时把状态位标红"，而不是"文件里出现过 draft-status"——
  // 后者被上面那行 HTML 就满足了，等于没测。
  assert.match(s, /el\.className = 'status err'/, '保存失败时没有把状态标成错误');
  assert.match(s, /console\.warn\('草稿自动保存失败/, '保存失败没有在控制台留痕');
  assert.match(s, /console\.warn\('草稿读取失败/, '读取草稿失败没有留痕');
});

test('访问统计失败会留痕（否则"没人访问"和"统计坏了"长得一样）', () => {
  const s = readFileSync(path.join(ROOT, 'js', 'tracking.js'), 'utf8');
  assert.match(s, /console\.warn\('访问统计未记录/);
});
