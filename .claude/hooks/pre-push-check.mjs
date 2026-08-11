#!/usr/bin/env node
/**
 * PreToolUse(Bash) 闸门：git push 之前强制跑 `npm run check`。
 *
 * 为什么需要它
 * 2026-08-10 一天 8 次 push，`/deploy-check` 一次都没触发——它的触发条件写在
 * "用户说'准备 push'"上，而执行 push 的是 Claude。闸门挂在措辞上就等于不存在。
 * 这个 hook 把"跑闸门"从"记得做"变成"不做就推不了"。
 *
 * 这道闸保证什么 / 不保证什么
 *   保证：推上去的代码通过了 lint / 格式 / 单测 / 死链扫描 / Tailwind 校验。
 *   不保证：页面视觉正确（`npm run check` 完全不验证布局）、HTML 内联 script
 *          语法（它不解析内联脚本）、线上真的可用、需单独部署的部分已部署。
 *          这些属于判断，交给 `/deploy-check`，本闸门刻意只做确定性的一件事。
 *
 * 设计原则（借鉴 bytedance/deer-flow 的 read-before-write gate）
 *   - 只做一件确定性的事，不做聪明判断
 *   - fail-open：闸门自身出任何问题都放行并说明原因，绝不把人锁死
 *   - 拦截时给恢复路径，而不是只说"不合规"
 *
 * 为什么是子串匹配而不是前缀匹配
 * settings.local.json 里早就有 `Bash(git push*)` 的 deny 规则，但它是前缀匹配，
 * 而实际命令长这样：`cd "..." && git add -A && git commit ... && git push origin main`
 * ——不以 `git push` 开头，规则从未命中。所以这里必须扫整条命令。
 */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// <repo>/.claude/hooks/pre-push-check.mjs → 上两级即仓库根。
// 从脚本自身位置推导，不依赖 hook 的工作目录。
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CHECK_TIMEOUT_MS = 180_000;

function emit(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }) + '\n',
  );
  process.exit(0);
}

/** 放行并说明原因——闸门自身失效时走这里。 */
function failOpen(why) {
  emit(
    'allow',
    `[pre-push 闸门未生效，已放行] ${why}\n（这是刻意的 fail-open：护栏不该把人锁死。请自己跑一次 npm run check。）`,
  );
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let payload;
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  // stdin 不是合法 JSON —— 无法判断这是什么命令，放行。
  failOpen('无法解析 hook 输入 JSON');
}

const command = String(payload?.tool_input?.command ?? '');

// 只管 git push。注意 docs-sync.sh 内部也有 git push，但命令行里看不到
// "git push" 字样，所以不会被拦——文档提交不需要跑代码闸门，这是想要的行为。
if (!/\bgit\s+push\b/.test(command)) {
  process.exit(0); // 无决定，正常流程
}

const pkgPath = resolve(REPO_ROOT, 'package.json');
if (!existsSync(pkgPath)) {
  failOpen(`在 ${REPO_ROOT} 找不到 package.json`);
}

let hasCheckScript = false;
try {
  hasCheckScript = Boolean(JSON.parse(readFileSync(pkgPath, 'utf8'))?.scripts?.check);
} catch (e) {
  failOpen(`package.json 解析失败：${e.message}`);
}
if (!hasCheckScript) {
  failOpen('package.json 里没有 "check" 脚本');
}

let res;
try {
  res = spawnSync('npm', ['run', 'check'], {
    cwd: REPO_ROOT,
    shell: true, // Windows 上 npm 是 npm.cmd，需要 shell 解析
    encoding: 'utf8',
    timeout: CHECK_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (e) {
  failOpen(`无法启动 npm：${e.message}`);
}

if (res.error) {
  failOpen(`npm run check 启动失败：${res.error.message}`);
}
if (res.signal === 'SIGTERM' || res.status === null) {
  failOpen(`npm run check 超过 ${CHECK_TIMEOUT_MS / 1000}s 未结束`);
}

if (res.status === 0) {
  emit(
    'allow',
    'pre-push 闸门通过：npm run check 全绿。（注意它不覆盖视觉/内联脚本/线上验证——那些看 /deploy-check）',
  );
}

// 失败：拦下来，并给恢复路径。
const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
const tail = out.trimEnd().split('\n').slice(-30).join('\n');

emit(
  'deny',
  [
    `npm run check 失败（退出码 ${res.status}），push 已拦下。`,
    '',
    '最后 30 行输出：',
    tail,
    '',
    '怎么修：',
    '  · prettier 报格式问题 → npx prettier --write <文件>（新建文件几乎总会被它拦，且它排在测试之前，会让后面步骤跑不到）',
    '  · eslint 报错 → 按提示改，不要用 --no-verify 绕过',
    '  · 单测失败 → 先确认是代码坏了还是测试断言写错了；改完记得跑突变验证',
    '  · 死链/缺 alt → scripts/qa/scan.js 的输出会指出具体文件行号',
    '',
    '修完重新 push 即可，本闸门会再跑一次。',
    '确有正当理由要跳过时，把 push 拆成不含 "git push" 字样的形式（例如写进脚本）——',
    '但那等于自己关掉护栏，请先说清为什么。',
  ].join('\n'),
);
