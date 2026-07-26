// 校验 css/tailwind.min.css 是否与当前 4 个页面的 class 同步。
// 做法：用与 build:css 完全相同的配置把 CSS 重新生成到临时文件，跟已提交的
// css/tailwind.min.css 逐字节比对（比对前把换行统一成 LF，规避 Windows CRLF
// 与 Linux CI LF 的假差异）。不一致 = 有人改了页面 class 却没重新生成 → 非零退出。
// 用法：node scripts/qa/check-css.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COMMITTED = path.join(ROOT, 'css', 'tailwind.min.css');
const TMP = path.join(os.tmpdir(), `tailwind-check-${process.pid}.css`);
// 从 Node 里跨平台调 Tailwind CLI：用 node 直接跑 CLI 的 js 入口，绕开 Windows 的 .bin/.cmd 问题
const CLI = require.resolve('tailwindcss/lib/cli.js', { paths: [ROOT] });

const normalize = (s) => s.replace(/\r\n/g, '\n');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(COMMITTED)) {
  fail('缺少 css/tailwind.min.css，请先运行 npm run build:css 生成并提交。');
}

try {
  execFileSync(
    process.execPath,
    [CLI, '-c', 'tailwind.config.js', '-i', 'css/tailwind.src.css', '-o', TMP, '--minify'],
    { cwd: ROOT, stdio: 'pipe' },
  );
} catch (e) {
  fail('重新生成 Tailwind CSS 失败：' + (e.stderr ? e.stderr.toString() : e.message));
}

const fresh = normalize(fs.readFileSync(TMP, 'utf8'));
const committed = normalize(fs.readFileSync(COMMITTED, 'utf8'));
fs.rmSync(TMP, { force: true });

if (fresh !== committed) {
  fail(
    '检测到 4 个页面用到的 Tailwind class 有变化，但 css/tailwind.min.css 没有同步更新。\n' +
      '请运行 npm run build:css，再把更新后的 css/tailwind.min.css 一起提交。',
  );
}

console.log('Tailwind CSS 校验通过：css/tailwind.min.css 与页面 class 同步。');
