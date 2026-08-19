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

test('main.js 暴露了 sdfLang（页面拿不到语言就只能一直发 zh）', () => {
  const s = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  assert.match(s, /window\.sdfLang = function \(\) \{\s*return currentLang;/);
});
