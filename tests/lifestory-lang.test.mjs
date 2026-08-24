import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LANGS,
  normalizeLang,
  langSpec,
  langDirective,
} from '../functions/api/_lib/lifestory-lang.js';
import { buildProbePrompt } from '../functions/api/_lib/lifestory-probe.js';

// 人生故事这个工具里，用户看到的文字有两个来源：界面文案（走 T）和**模型生成的
// 内容**（追问句、衔接句、最终成稿）。后者此前一律是中文硬编码，于是把题库翻成
// 日文会得到「日文的问题 + 中文的追问 + 中文的传记」——比全中文更糟。
// 这些测试守的是"语言真的传下去了"，不是"函数能跑"。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('lang 是不可信输入：认不出的一律回落 zh', () => {
  for (const bad of [undefined, null, '', 'ja-JP', 'ZH', 'fr', 42, {}, 'zh; DROP']) {
    assert.equal(normalizeLang(bad), 'zh', `${JSON.stringify(bad)} 应回落 zh`);
  }
  for (const good of LANGS) assert.equal(normalizeLang(good), good);
});

test('三种语言各有自己的长度约束——一句话的字面长度差很远', () => {
  const lens = LANGS.map((l) => langSpec(l).bridgeLen);
  assert.equal(new Set(lens).size, 3, `三者不该共用同一个长度：${lens.join(' / ')}`);
  assert.match(langSpec('en').bridgeLen, /word/i, '英文该按词数算，不是字数');
});

test('语言指令覆盖三种语言，且各自点名了目标语言', () => {
  assert.match(langDirective('zh'), /简体中文/);
  assert.match(langDirective('ja'), /日本語/);
  assert.match(langDirective('en'), /English/);
});

// 受访者可能用另一种语言作答（日语界面下用中文讲述完全可能）。
// 没有这句，同一篇稿子里会中日混排。
test('指令明确要求"无论受访者用什么语言作答"都跟随界面语言', () => {
  for (const l of LANGS) {
    assert.match(langDirective(l), /无论受访者用什么语言作答/, `${l} 缺这条`);
  }
});

// 日语访谈的对象常常是年长者，用简体（だ・である）是失礼的。
// 这不是文体偏好，写进测试是因为它容易在后续改动里被顺手抹掉。
test('日语必须指定丁寧語', () => {
  assert.match(langSpec('ja').register, /丁寧語|ですます/);
});

test('追问提示词把语言传下去了，且点名 followup/softLanding 要用该语言', () => {
  const ja = buildProbePrompt('Q', 'A', [], [], 'ja');
  assert.match(ja, /日本語/, '追问提示词里没有语言指令');
  assert.match(ja, /followup\.question/, '没点名追问句要跟随语言');
  assert.match(ja, /softLanding/, '没点名软着陆句要跟随语言');
  // tags 是固定英文词表，翻了会让下游匹配全部失效——和校对工具 keywords 同类陷阱。
  assert.match(ja, /tags 仍从上面那份英文词表里选，不翻译/);
});

test('不传 lang 时行为不变（老调用方不会被这次改动改掉产出）', () => {
  assert.equal(buildProbePrompt('Q', 'A'), buildProbePrompt('Q', 'A', [], [], 'zh'));
});

// 下面两条盯的是接线，不是逻辑：三个动作里漏掉任何一个，
// 用户就会在那一步撞见另一种语言，而且不报错。
test('后端三个动作全部改成语言相关（漏一个就在那一步换语言）', () => {
  const s = readFileSync(path.join(ROOT, 'functions', 'api', 'lifestory.js'), 'utf8');
  assert.match(s, /const lang = normalizeLang\(body\.lang\)/, '没有从请求体取 lang');
  assert.match(s, /buildProbePrompt\(question, answer, recentHistory, knownTags, lang\)/);
  assert.match(s, /bridgeSys\(lang\)/);
  assert.match(s, /storySys\(lang\)/);
  // 旧的语言无关常量不该还在被使用
  assert.doesNotMatch(s, /qwen\(\s*apiKey,\s*SYS_BRIDGE/);
  assert.doesNotMatch(s, /qwen\(\s*apiKey,\s*SYS_STORY/);
});

test('前端三个调用点都带上了界面语言', () => {
  const s = readFileSync(path.join(ROOT, 'solutions', 'demo', 'lifestory.html'), 'utf8');
  const calls = [...s.matchAll(/action: '(probe|bridge|story)'/g)].map((m) => m[1]);
  assert.deepEqual(calls.sort(), ['bridge', 'probe', 'story'], '调用点数量变了，这条要跟着改');
  // 每个 action 所在的那段 body 里都必须出现 lang
  for (const action of calls) {
    const i = s.indexOf(`action: '${action}'`);
    const seg = s.slice(i, i + 400);
    assert.match(seg, /lang: uiLang\(\)/, `${action} 没带上界面语言`);
  }
  assert.match(s, /window\.sdfLang \? window\.sdfLang\(\) : 'zh'/, 'uiLang 回落写法变了');
});

// 2026-08-19：删掉 action === 'analyze' 时加的。它是两步走旧设计的残骸，
// 前端调用早在 865a8d7 就删了，服务端分支却留着——那次清理只做了一半。
// 代价不是"多几行代码"：它自带一份分析提示词，活着的那份后来长出了整块
// 访谈规则，加语言指令时也只有活的那份跟上了。**改活的那份时不会想起死的那份。**
// 这条断言让"服务端留了个没人调的分支"变成红灯。
test('服务端接受的 action 与前端实际发出的完全一致', () => {
  const server = readFileSync(path.join(ROOT, 'functions', 'api', 'lifestory.js'), 'utf8');
  const page = readFileSync(path.join(ROOT, 'solutions', 'demo', 'lifestory.html'), 'utf8');

  // 只认 if 判断里的，避免把注释里提到的旧名字算进来
  const accepted = [...server.matchAll(/if \(action === '(\w+)'\)/g)].map((m) => m[1]).sort();
  const sent = [...new Set([...page.matchAll(/action: '(\w+)'/g)].map((m) => m[1]))].sort();

  assert.ok(accepted.length >= 3, `只解析到 ${accepted.length} 个服务端 action，护栏失效`);
  assert.deepEqual(
    accepted,
    sent,
    `服务端与前端的 action 集合不一致。\n服务端：${accepted.join(', ')}\n前端：${sent.join(', ')}`,
  );
  // 删干净了：连同它那份提示词一起。
  // 只认**定义**，不认名字——文件顶部的注释里写了它为什么被删，
  // 用 /SYS_ANALYZE/ 会被那段注释满足（实测红过一次）。
  assert.doesNotMatch(server, /const SYS_ANALYZE/, '第二份分析提示词又回来了');
});

test('main.js 暴露了 sdfLang（页面拿不到语言就只能一直发 zh）', () => {
  const s = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  assert.match(s, /window\.sdfLang = function \(\) \{\s*return currentLang;/);
});

// 2026-08-24：语音识别的语种此前写死 'zh-CN'。08-19 把界面做成三语时没有跟着改，
// 于是日语用户看到「音声入力」、说日语，被当成普通话识别 —— 出来是乱码，**不报错**。
// 本工具面向各国中老年用户，语音是主要输入方式，识别语种错了整条路就不通。
test('语音识别的语种跟随界面语言，而不是写死中文', () => {
  const s = readFileSync(path.join(ROOT, 'solutions', 'demo', 'lifestory.html'), 'utf8');

  // 三个语种都要有映射
  assert.match(s, /REC_LANG = \{[^}]*zh: 'zh-CN'[^}]*\}/s, '缺 zh 映射');
  assert.match(s, /REC_LANG = \{[^}]*ja: 'ja-JP'[^}]*\}/s, '缺 ja 映射');
  assert.match(s, /REC_LANG = \{[^}]*en: 'en-US'[^}]*\}/s, '缺 en 映射');

  // 必须由 uiLang() 决定，不能是常量
  assert.match(s, /recognition\.lang = REC_LANG\[uiLang\(\)\]/, '识别语种没有跟随界面语言');
  assert.doesNotMatch(s, /recognition\.lang = 'zh-CN'/, '又写死成中文了');

  // ★ 关键：必须在**每次开始录音前**设。recognition 只创建一次，
  // 放进 initRec() 的话，中途切语言不会生效 —— 而且同样不报错。
  const starts = [...s.matchAll(/recognition\.start\(\)/g)];
  assert.equal(
    starts.length,
    1,
    `启动路径有 ${starts.length} 条，每条都要先设语种，这条断言要跟着改`,
  );
  const before = s.slice(Math.max(0, starts[0].index - 200), starts[0].index);
  assert.match(before, /applyRecLang\(\)/, 'start() 之前没有设置识别语种');

  // initRec 里不该再设：那等于回到"只在创建时设一次"
  const initBody = s.slice(s.indexOf('function initRec()'), s.indexOf('function applyRecLang()'));
  assert.doesNotMatch(initBody, /\.lang =/, 'initRec 里又设了一次，切语言会失效');
});
