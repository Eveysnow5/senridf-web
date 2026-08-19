import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 人生故事的题库在 lifestory.html 的内联脚本里，没有模块边界可以 import。
// 做法：把 ANCHORS / HISTORICAL_BY_LANG / LEGACY_CAT 三段源码抠出来求值。
// 这样测的是**真正会跑的那份数据**，不是另抄一份夹具——
// 夹具总比现实小一号，抄一份的话改了页面而忘了改夹具，测试照样全绿。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'solutions', 'demo', 'lifestory.html'), 'utf8');
const MAIN = readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

/** 抠出 `const NAME = ...;` 到配平括号处，求值成真对象。 */
function evalConst(name, open, close) {
  const marker = `const ${name} = ${open}`;
  const start = SRC.indexOf(marker);
  assert.ok(start > 0, `源码里找不到 ${name}`);
  let i = start + marker.length - 1;
  let depth = 0;
  let end = -1;
  for (; i < SRC.length; i++) {
    if (SRC[i] === open) depth++;
    else if (SRC[i] === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.ok(end > 0, `${name} 括号不配平`);
  return new Function(`return ${SRC.slice(start + `const ${name} = `.length, end + 1)};`)();
}

const ANCHORS = evalConst('ANCHORS', '[', ']');
const BANKS = evalConst('HISTORICAL_BY_LANG', '{', '}');
const LEGACY_CAT = evalConst('LEGACY_CAT', '{', '}');
const LANGS = ['zh', 'ja', 'en'];

test('护栏自身有效：三段数据都抠出来了', () => {
  assert.equal(ANCHORS.length, 15, `锚点题应有 15 道，实际 ${ANCHORS.length}`);
  assert.deepEqual(Object.keys(BANKS).sort(), LANGS.slice().sort());
  assert.equal(Object.keys(LEGACY_CAT).length, 15);
});

test('每道锚点题三语齐全 —— 缺一条那个语种就回落中文，页面上不报错', () => {
  for (const q of ANCHORS) {
    for (const l of LANGS) {
      assert.ok(q.text[l], `${q.id} 缺 ${l}`);
      assert.ok(q.text[l].length > 10, `${q.id} 的 ${l} 太短，像是占位符：${q.text[l]}`);
    }
    // 日英题面里不该混进中文（复制粘贴时最容易发生）
    assert.doesNotMatch(q.text.en, /[一-鿿]/, `${q.id} 的英文里有汉字`);
  }
});

test('id 唯一 —— 重复的话 usedIds 会把两道题一起判成已用过', () => {
  const ids = [...ANCHORS.map((q) => q.id), ...LANGS.flatMap((l) => BANKS[l].map((q) => q.id))];
  assert.equal(new Set(ids).size, ids.length, `有重复 id：${ids.join(',')}`);
});

test('cat 是键不是文案，且每个键在 T 的三个语种里都有标签', () => {
  for (const q of ANCHORS) {
    assert.match(q.cat, /^[a-z]+$/, `${q.id} 的 cat 还是显示文案：${q.cat}`);
  }
  const keys = [...new Set(ANCHORS.map((q) => q.cat))];
  assert.equal(keys.length, 15, '15 道题应对应 15 个不同主题');
  for (const k of keys) {
    // 三个语种块各出现一次，共三次；少于三次说明某个语种漏了
    const n = (MAIN.match(new RegExp(`ls_cat_${k}:`, 'g')) || []).length;
    assert.equal(n, 3, `ls_cat_${k} 在 T 里出现 ${n} 次（应为三语各一次）`);
  }
});

// 旧存档里 cat 存的是中文显示名。迁移表漏一个，那位用户的 themeFilter
// 就永远匹配不上，界面显示「你已经回答了所有问题」——访谈直接断掉，不报错。
test('旧中文 cat 全都能迁移到新键，且目标键真实存在', () => {
  const keys = new Set(ANCHORS.map((q) => q.cat));
  const mapped = new Set(Object.values(LEGACY_CAT));
  for (const [zh, key] of Object.entries(LEGACY_CAT)) {
    assert.ok(keys.has(key), `${zh} 映射到了不存在的键 ${key}`);
  }
  assert.equal(mapped.size, keys.size, '迁移表没有覆盖全部 15 个主题');
});

test('历史题：年份区间合法，占位符只用已支持的两个', () => {
  for (const l of LANGS) {
    assert.ok(BANKS[l].length >= 5, `${l} 只有 ${BANKS[l].length} 道历史题`);
    for (const q of BANKS[l]) {
      assert.ok(Array.isArray(q.yearRange) && q.yearRange.length === 2, `${q.id} 年份区间格式不对`);
      assert.ok(q.yearRange[0] <= q.yearRange[1], `${q.id} 年份区间反了`);
      for (const ph of q.text.match(/\{(\w+)\}/g) || []) {
        assert.ok(['{location}', '{year}'].includes(ph), `${q.id} 用了不支持的占位符 ${ph}`);
      }
    }
  }
});

// locations 是拿来匹配**模型抽出的地点**的，不是显示文案。字形必须与该语言
// 受访者会写出的一致：简体 '东京' 匹配不上日语「東京」。旧版整份都是简体，
// 所以对非中文输入形同虚设——这条就是为了不让它再次发生。
test('日语历史题的 locations 不含简体专用字形', () => {
  const SIMPLIFIED_ONLY = ['东京', '大阪府', '关西', '兵库', '神户', '广岛'];
  for (const q of BANKS.ja) {
    if (!q.locations) continue;
    for (const loc of q.locations) {
      assert.ok(!SIMPLIFIED_ONLY.includes(loc), `${q.id} 的 locations 里有简体字形：${loc}`);
      assert.doesNotMatch(loc, /[东关户库广]/, `${q.id} 的 ${loc} 像是简体`);
    }
  }
});

test('英文历史题全部不依赖地点（英语没有默认国家）', () => {
  for (const q of BANKS.en) {
    assert.equal(q.locations, null, `${q.id} 绑了地点，但英文界面没有默认国家`);
  }
});

// nextQuestion 取的是**第一个**匹配项。范围很宽的相对时间锚放在前面
// 会把具体事件全部挡掉，而表现只是"问题变泛了"，没人会注意到。
test('英文题库里范围最宽的两道排在最后', () => {
  const spans = BANKS.en.map((q) => q.yearRange[1] - q.yearRange[0]);
  const widestTwo = [...spans].sort((a, b) => b - a).slice(0, 2);
  const lastTwo = spans.slice(-2);
  assert.deepEqual(
    lastTwo.slice().sort((a, b) => b - a),
    widestTwo,
    `最宽的两道没排在最后，会挡掉具体事件：${spans.join(',')}`,
  );
});

// 上一条只证明"调用还在"。把函数改成 `return s;` 直接放行，源码断言照样绿
// （突变验证实测逃逸过）。所以这里把函数本体抠出来**真跑一遍**。
test('迁移函数真的会改写旧存档，不是个空壳', () => {
  const start = SRC.indexOf('function migrateCats(s) {');
  assert.ok(start > 0, '找不到 migrateCats');
  let depth = 0;
  let end = -1;
  for (let i = SRC.indexOf('{', start); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.ok(end > 0, 'migrateCats 括号不配平');
  const migrate = new Function('LEGACY_CAT', `${SRC.slice(start, end + 1)}; return migrateCats;`)(
    LEGACY_CAT,
  );

  const old = { themeFilter: '起点', answers: [{ cat: '金钱' }, { cat: '传承' }] };
  const got = migrate(old);
  assert.equal(got.themeFilter, 'origin', 'themeFilter 没被迁移 —— 那位用户一道题也出不来');
  assert.deepEqual(
    got.answers.map((a) => a.cat),
    ['money', 'legacy'],
    '历史回答的 cat 没被迁移',
  );
  // 已经是新键的不该被再动一次
  assert.equal(migrate({ themeFilter: 'origin', answers: [] }).themeFilter, 'origin');
  // 坏输入不能让它抛错——载入存档失败等于用户的访谈没了
  assert.doesNotThrow(() => migrate(null));
  assert.doesNotThrow(() => migrate({ answers: 'not an array' }));
});

test('页面用的是按语言取的题库，没有退回单一数组', () => {
  assert.match(SRC, /const historicalBank = \(\) =>/, '缺少按语言取题库的函数');
  assert.doesNotMatch(SRC, /\[\.\.\.ANCHORS, \.\.\.HISTORICAL\]/, '还在用旧的单一 HISTORICAL');
  assert.match(SRC, /historicalBank\(\)\.find\(/, '选题没走按语言的题库');
  assert.match(SRC, /catLabel\(q\.cat\)/, '分类还在直接显示键');
  // 必须匹配**调用点**：只写 /migrateCats\(/ 会被函数定义那一行满足，
  // 把调用删掉照样绿（2026-08-19 突变验证实测逃逸过一次）。
  assert.match(SRC, /migrateCats\(JSON\.parse\(/, '载入存档时没有调用 cat 迁移');
});
