import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CSP 的失败方式是**静默且延迟**的：Report-Only 期间违规只打印到 DevTools 控制台，
// 没人开着控制台就等于没发生；一旦改成强制，被拦的请求跟"网络失败"长得一模一样，
// 而调用处往往有 catch 兜底（admin 的镜像轮询就是 `catch { /* 网络抖动 */ }`），
// 于是表现成"转五分钟然后说状态未确认"，不报错、不留痕。
//
// 运行时已有一条收集链路：`js/shared/report-error.js` 监听 `securitypolicyviolation`，
// 违规写进 Firestore `errors`，后台「错误日志」面板可看（两个 admin 页都挂了）。
// 但它有个结构性盲区——**只有代码路径真的跑到，违规才会发生**。admin 的镜像轮询
// 只在"发布文章之后"触发，于是 2026-07 开的观察期到 08-19 都没抓到它。
// 这套静态断言正是补这一块：不需要有人去跑那条路径。两者互补，不是替代。
//
// ⚠️ 能力边界（写在这里，免得后人以为它管得比实际宽）：
//   只认**字面量 URL**。运行时拼出来的地址（Firebase SDK 内部连的
//   *.googleapis.com / securetoken.google.com、Deepgram SDK 的 wss 等）静态看不见。
//   所以本文件**不检查"白名单里有没有多余项"**——那些"看着没人用"的条目恰恰是
//   SDK 在运行时要用的，删掉就是线上事故。宁可留冗余，不可误删。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 解析 _headers 里的 CSP ──────────────────────────────────────────────────
const HEADERS = readFileSync(path.join(ROOT, '_headers'), 'utf8');
const cspLine = HEADERS.match(/^\s*Content-Security-Policy(-Report-Only)?:\s*(.+)$/m);

test('护栏自身有效：_headers 里能找到 CSP', () => {
  assert.ok(cspLine, '_headers 里没有 Content-Security-Policy，护栏形同虚设');
});

const IS_REPORT_ONLY = Boolean(cspLine[1]);
const DIRECTIVES = new Map(
  cspLine[2]
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .filter((p) => p[0])
    .map((p) => [p[0], p.slice(1)]),
);

test('护栏自身有效：切出了预期的指令', () => {
  for (const d of ['script-src', 'style-src', 'connect-src', 'worker-src']) {
    assert.ok(DIRECTIVES.has(d), `CSP 里缺 ${d}，或解析没切开`);
  }
});

/** 某个来源是否被指令覆盖。支持 `*.example.com` 通配与 'self'（本站域名）。 */
const SELF_HOSTS = new Set(['www.senridf.com', 'senridf.com']);
function covered(directive, url) {
  const sources = DIRECTIVES.get(directive) ?? DIRECTIVES.get('default-src') ?? [];
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return true; // 相对路径 / mailto: 之类，与 CSP 主机白名单无关
  }
  if (SELF_HOSTS.has(host) && sources.includes("'self'")) return true;
  return sources.some((src) => {
    if (!/^(https?|wss):\/\//.test(src)) return false;
    const pattern = new URL(src).host;
    if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1));
    return host === pattern;
  });
}

// ── 收集浏览器真的会执行的文件 ──────────────────────────────────────────────
// 排除的是**跑在服务端或本地的代码**：functions/（Pages Functions）、workers/、
// scripts/（Node 爬虫）、tools/（本地工具）、tests/fixtures（抓下来的样本页）。
// 它们的外连不经过浏览器，CSP 管不着。
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'docs',
  'functions',
  'workers',
  'scripts',
  'tools',
  'fixtures',
]);
function browserFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('__')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) browserFiles(p, acc);
    else if (name.endsWith('.html') || name.endsWith('.js')) acc.push(p);
  }
  return acc;
}
const FILES = browserFiles(ROOT).filter((p) => {
  const rel = path.relative(ROOT, p).split(path.sep).join('/');
  return !rel.startsWith('tests/');
});

test('护栏自身有效：扫到了浏览器文件', () => {
  assert.ok(FILES.length >= 30, `只扫到 ${FILES.length} 个文件`);
});

/** 在所有浏览器文件里跑一遍正则，返回 [{file, url}]。 */
function collect(re) {
  const hits = [];
  for (const p of FILES) {
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(re)) {
      hits.push({ file: path.relative(ROOT, p).split(path.sep).join('/'), url: m[1] });
    }
  }
  return hits;
}

// fetch('https://…') / new WebSocket('wss://…')，以及先存进常量再 fetch 的写法
// （admin 的 MIRROR_API 正是后者，所以只匹配 fetch( 会漏掉它）。
const CONNECT_RE =
  /(?:fetch|WebSocket|EventSource)\s*\(\s*['"`]((?:https?|wss):\/\/[^'"`]+)|(?:const|let|var)\s+\w*(?:URL|API|ENDPOINT|_URL|_API)\w*\s*=\s*['"`]((?:https?|wss):\/\/[^'"`]+)/gi;

function collectConnect() {
  const hits = [];
  for (const p of FILES) {
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(CONNECT_RE)) {
      hits.push({
        file: path.relative(ROOT, p).split(path.sep).join('/'),
        url: m[1] || m[2],
      });
    }
  }
  return hits;
}

const CONNECTS = collectConnect();
const SCRIPTS = collect(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi);
// 外部样式表：Google Fonts 的地址是 /css2?family=… ，**不以 .css 结尾**，
// 所以不能靠扩展名认。改成整段取 <link> 标签、再要求它带 rel="stylesheet"
// （属性顺序在本仓库里两种都有，href 可能在 rel 前面）。
// preconnect / dns-prefetch 不受 CSP 主机白名单约束，不算在内。
function collectStyles() {
  const hits = [];
  for (const p of FILES) {
    const src = readFileSync(p, 'utf8');
    for (const tag of src.matchAll(/<link[^>]*>/gi)) {
      if (!/rel=["']stylesheet["']/i.test(tag[0])) continue;
      const href = tag[0].match(/href=["'](https?:\/\/[^"']+)["']/i);
      if (href) {
        hits.push({ file: path.relative(ROOT, p).split(path.sep).join('/'), url: href[1] });
      }
    }
  }
  return hits;
}
const STYLES = collectStyles();

test('护栏自身有效：三个提取器都抓到了已知存在的来源', () => {
  // 这些数字不是"当前值"，是**下限**：站点确实有这么多外部依赖。
  // 提取器哪天被改坏（正则失配、目录被排除掉），这三条先红。
  assert.ok(CONNECTS.length >= 5, `外连只抓到 ${CONNECTS.length} 处`);
  assert.ok(SCRIPTS.length >= 5, `外部 <script src> 只抓到 ${SCRIPTS.length} 处`);
  assert.ok(STYLES.length >= 3, `外部样式表只抓到 ${STYLES.length} 处`);
  // 抓到的必须真是外部主机，不能是把相对路径也算进来凑数
  const hosts = new Set([...CONNECTS, ...SCRIPTS, ...STYLES].map((h) => new URL(h.url).host));
  assert.ok(hosts.size >= 5, `只覆盖 ${hosts.size} 个不同主机`);
});

test('浏览器里的外连主机都在 connect-src 白名单里', () => {
  const bad = CONNECTS.filter((h) => !covered('connect-src', h.url)).map(
    (h) => `${h.file} → ${new URL(h.url).host}`,
  );
  assert.deepEqual(
    [...new Set(bad)],
    [],
    `CSP 转强制后这些请求会被拦，且调用处多半有 catch 兜底、表现成"网络失败"：\n${[...new Set(bad)].join('\n')}`,
  );
});

test('外部 <script src> 都在 script-src 白名单里', () => {
  const bad = SCRIPTS.filter((h) => !covered('script-src', h.url)).map(
    (h) => `${h.file} → ${new URL(h.url).host}`,
  );
  assert.deepEqual(
    [...new Set(bad)],
    [],
    `这些脚本会被 CSP 拦掉：\n${[...new Set(bad)].join('\n')}`,
  );
});

test('外部样式表都在 style-src 白名单里', () => {
  const bad = STYLES.filter((h) => !covered('style-src', h.url)).map(
    (h) => `${h.file} → ${new URL(h.url).host}`,
  );
  assert.deepEqual(
    [...new Set(bad)],
    [],
    `这些样式表会被 CSP 拦掉：\n${[...new Set(bad)].join('\n')}`,
  );
});

// 观察期总要有个终点。这条不是失败，是**提醒**：只要还是 Report-Only，
// 上面三条全绿也只说明"字面量层面没问题"，CSP 本身仍然一个请求都不拦。
test('记录 CSP 当前是观察期还是强制（转强制前先让上面三条绿）', () => {
  assert.ok(typeof IS_REPORT_ONLY === 'boolean', 'CSP 模式判定失效');
  if (IS_REPORT_ONLY) {
    console.log(
      '  ℹ CSP 仍是 Report-Only：违规只进 DevTools 控制台，不拦截。转强制改 _headers 里的 header 名。',
    );
  }
});

// ── 运行时渠道捞到的违规（2026-08-24）──────────────────────────────────────
// 后台错误日志里出现三条 CSP 违规，全部来自 Firebase Auth 的弹窗/跳转登录解析器：
// gapi 的 iframe 装载器（apis.google.com）+ authDomain 上的隐藏 iframe。
//
// **这三条静态扫描原理上抓不到**：URL 由 SDK 在运行时拼出，还带随机后缀
// （?onload=__iframefcb292202）。它们是 report-error.js 的 securitypolicyviolation
// 上报捞到的 —— 正是本文件开头写的"两条渠道互补"的一个实证。
//
// 放行的理由不是怕它坏（本站只用邮箱密码登录，这套机制用不上），
// 而是不放行的话日志里会一直堆这三条已知的良性违规，而**日志里堆着良性噪声
// 正是真违规被漏掉的路径**。
test('Firebase Auth 的 iframe 机制已放行（否则错误日志会一直堆良性噪声）', () => {
  assert.ok(covered('script-src', 'https://apis.google.com/js/api.js'), 'gapi 装载器没放行');
  assert.ok(
    covered('frame-src', 'https://senridfauthentication.firebaseapp.com/__/auth/iframe'),
    'authDomain 的隐藏 iframe 没放行',
  );
});

// frame-src 此前**完全没有声明**，靠 default-src 'self' 回落。能用，但意图不可见：
// 读规则的人无法区分"想清楚了只允许同源"和"压根没考虑过 iframe"。
test('frame-src 显式声明，不靠 default-src 回落', () => {
  assert.ok(DIRECTIVES.has('frame-src'), 'frame-src 又退回成靠 default-src 回落了');
  // frame-ancestors 管的是"谁能嵌入我们"，跟"我们能嵌入谁"是两回事，别混为一谈
  assert.ok(DIRECTIVES.has('frame-ancestors'), 'frame-ancestors 不该被 frame-src 取代');
});

// 站内自己的 iframe 都是同源的（admin 页面预览、宏观看板）。哪天加了外部 iframe
// 而 frame-src 没跟着加，页面上就是一块空白 —— 不报错、不留痕。
//
// ⚠️ 能力边界：本站这两个 iframe 的 src 都是**用 JS 赋的**（`frame.src = …`），
// 标签上没有 src 属性。所以只扫 `<iframe src="…">` 会一个都匹配不到、断言空转
// 通过 —— 首版就是这样，靠下面那条自检才发现。
// 现在两头都查：标签必须扫得到（证明扫描器有效），字面量地址无论写在属性上
// 还是赋给 `.src` 都要对账。运行时拼出来的地址仍然看不见，那部分归
// report-error.js 的 securitypolicyviolation 上报管。
test('站内 iframe 仍然全是同源（外部 iframe 需要同步 frame-src）', () => {
  let tags = 0;
  const external = [];
  for (const p of FILES) {
    const src = readFileSync(p, 'utf8');
    tags += [...src.matchAll(/<iframe\b/gi)].length;
    const literal = [
      ...src.matchAll(/<iframe\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi),
      ...src.matchAll(/\.src\s*=\s*['"`](https?:\/\/[^'"`]+)/gi),
    ];
    for (const m of literal) {
      // 脚本节点也走 .src，所以两个指令有一个盖得住就算过
      if (!covered('frame-src', m[1]) && !covered('script-src', m[1])) {
        external.push(`${path.relative(ROOT, p).split(path.sep).join('/')} → ${m[1]}`);
      }
    }
  }
  assert.ok(tags >= 2, `只扫到 ${tags} 个 iframe 标签，扫描器失效（站内已知有两个）`);
  assert.deepEqual(external, [], `这些会被 CSP 拦掉：\n${external.join('\n')}`);
});
