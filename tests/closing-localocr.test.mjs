// 本机识别助手的页面侧（solutions/demo/closing-localocr.mjs）：把 Windows 识别的「字和位置」拼回行。
// 行的形状照真实输出写（Windows 把日文每个字当一个词：「領 収 済 通 知 書」；淡的千分位逗号留下空隙：「5 538」）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  joinWords,
  toLines,
  toGray,
  findHelper,
  helperRead,
  locateHelper,
  permissionState,
  HELPER,
} from '../solutions/demo/closing-localocr.mjs';

const w = (t, x, y = 100, wd = 40, h = 40) => ({ t, b: [x, y, wd, h] });

test('日文的单字词按间距拼回去：间距小于字高不留空格', () => {
  assert.equal(joinWords([w('領', 0), w('収', 45), w('済', 90), w('通', 135)]), '領収済通');
});

test('间距大于字高留一个空格（表格的栏）', () => {
  assert.equal(joinWords([w('合', 0), w('計', 45), w('1', 200), w('5', 245)]), '合計 15');
});

test('数字之间放宽到 1.5 倍字高：「5 538」拼成 5538，栏和栏之间的数字仍分开', () => {
  assert.equal(joinWords([w('5', 0, 100, 20), w('538', 70, 100, 60)]), '5538'); // 间距 50 < 1.5×40
  assert.equal(joinWords([w('5', 0, 100, 20), w('538', 90, 100, 60)]), '5 538'); // 间距 70 > 60
});

test('英文单词之间总留空格', () => {
  assert.equal(joinWords([w('Company', 0, 100, 200), w('Name', 205, 100, 120)]), 'Company Name');
});

test('「′」读成的千分位逗号改回逗号', () => {
  assert.equal(joinWords([w('1′551円', 0, 100, 200)]), '1,551円');
});

test('词的先后按位置排，不按返回的顺序', () => {
  assert.equal(joinWords([w('計', 45), w('合', 0)]), '合計');
});

test('同一高度、左右分开的几块拼成一行，从左到右；不同高度分行，从上到下', () => {
  const raw = [
    { words: [w('946', 900, 1747, 60), w('円', 965, 1747)] },
    { words: [w('上', 500, 1748), w('水', 545, 1748)] },
    { words: [w('合', 500, 1660), w('計', 545, 1660)] },
  ];
  assert.deepEqual(toLines(raw), ['合計', '上水 946円']);
});

test('空的行和缺位置的词不出错、不出空行', () => {
  assert.deepEqual(toLines([{ words: [] }, { words: [{ t: 'x' }] }, {}]), []);
});

test('灰度：和 PIL 的 convert("L") 同一个公式', () => {
  const d = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 255,
  ]);
  toGray(d);
  assert.deepEqual([d[0], d[4], d[8], d[12]], [76, 150, 29, 18]); // PIL 12.2 实际给出的值
  assert.equal(d[3], 255); // alpha 不动
  assert.equal(d[1], d[0]);
});

test('找不到助手（连不上、超时、回答不对）都是 null，不报错', async () => {
  assert.equal(
    await findHelper(async () => Promise.reject(new TypeError('Failed to fetch'))),
    null,
  );
  assert.equal(await findHelper(async () => ({ ok: false })), null);
  assert.equal(await findHelper(async () => ({ ok: true, json: async () => ({}) })), null);
  const slow = (url, opt) =>
    new Promise((_, rej) => opt.signal.addEventListener('abort', () => rej(new Error('abort'))));
  assert.equal(await findHelper(slow, 20), null);
});

test('找到助手：只连本机的 127.0.0.1', async () => {
  let asked = '';
  const r = await findHelper(async (url) => {
    asked = url;
    return { ok: true, json: async () => ({ ok: true, version: '0.1.0', langs: ['ja'] }) };
  });
  assert.deepEqual(r, { version: '0.1.0', langs: ['ja'] });
  assert.equal(asked, `${HELPER}/ping`);
  assert.match(HELPER, /^http:\/\/127\.0\.0\.1:\d+$/);
});

test('识别：助手的错误原样报出（页面据此停止快路）', async () => {
  const blob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
  await assert.rejects(
    helperRead(blob, 'ja', async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'image too large' }),
    })),
    /image too large/,
  );
  const ok = await helperRead(blob, 'ja', async (url, opt) => {
    assert.equal(url, `${HELPER}/ocr?lang=ja`);
    assert.equal(opt.method, 'POST');
    return {
      ok: true,
      json: async () => ({ ms: 5, lines: [{ words: [w('領', 0), w('収', 45)] }] }),
    };
  });
  assert.deepEqual(ok.lines, ['領収']);
});

test('页面：有助手走快路，助手中途没了不悄悄换成浏览器识别', () => {
  const html = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing.html', import.meta.url)),
    'utf8',
  );
  assert.match(html, /import\('\.\/closing-localocr\.mjs\?v=\d+'\)/);
  assert.match(html, /locateHelper\(/);
  assert.match(html, /lost = true;/);
  assert.match(html, /id="ce-ev-helper"/);
});

test('混合：快路读的页对上模板但验算没过，用浏览器补读；补读的验算通过得更多才换用', () => {
  const html = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing.html', import.meta.url)),
    'utf8',
  );
  const fn = html.slice(
    html.indexOf('async function readFast('),
    html.indexOf('async function readFast(') + 1400,
  );
  assert.match(fn, /evAsk\('check', \[lines\]\)/);
  assert.match(fn, /a\.matched > a\.passed/);
  assert.match(fn, /b\.passed > a\.passed/);
  const copy = html.indexOf('const copy = retryCopy(pg.canvas)');
  assert.ok(
    copy > 0 && copy < html.indexOf('await fastRead(pg.canvas)', copy),
    '彩色副本要在转灰度之前拿',
  );
  const worker = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing-worker.js', import.meta.url)),
    'utf8',
  );
  assert.match(worker, /'check',/);
  const main = fs.readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
  for (const k of ['ce_ev_rereading', 'ce_ev_reread_sum'])
    assert.equal(main.split(`\n    ${k}:`).length - 1, 3, `${k} 三语`);
});

test('安全策略：connect-src 放行助手的地址', () => {
  const h = fs.readFileSync(fileURLToPath(new URL('../_headers', import.meta.url)), 'utf8');
  const csp = h.match(/^\s*Content-Security-Policy[^:]*:.*?(connect-src[^;]*)/m)[1]; // 头那一行（注释里也有这个词）
  assert.ok(csp.split(/\s+/).includes(HELPER), csp);
});

test('入口：表格和凭证各排各的队；排队・准备时马上提示（2026-10-15 作者：放进去几十秒没反应）', () => {
  const html = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing.html', import.meta.url)),
    'utf8',
  );
  const fn = html.slice(html.indexOf('function intake('), html.indexOf('function intake(') + 1600);
  assert.match(fn, /inboxChain = inboxChain/);
  assert.match(fn, /evInChain = evInChain/);
  assert.doesNotMatch(
    fn,
    /await tabAdd\(tabs\);\s*await evAdd\(evs\)/,
    '凭证不能排在表格后面（反过来也一样）',
  );
  assert.match(fn, /'ce_z_queued'/);
  assert.match(fn, /'ce_ev_queued'/);
  const ev = html.slice(
    html.indexOf('async function evAdd('),
    html.indexOf('async function evAdd(') + 1500,
  );
  assert.ok(
    ev.indexOf("'ce_ev_preparing'") > 0 &&
      ev.indexOf("'ce_ev_preparing'") < ev.indexOf('locateHelper'),
    '找助手之前先提示',
  );
  const main = fs.readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
  for (const k of ['ce_ev_preparing', 'ce_ev_queued', 'ce_z_queued'])
    assert.equal(main.split(`\n    ${k}:`).length - 1, 3, `${k} 三语`);
});

test('判断人：页面顶部一处，记在这台电脑；其他地方空着就用它', () => {
  const html = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing.html', import.meta.url)),
    'utf8',
  );
  const box = html.indexOf('id="ce-ev-box"');
  assert.ok(
    html.indexOf('id="ce-ev-by"') > 0 && html.indexOf('id="ce-ev-by"') < box,
    '不在凭证列表里（打开前看不到）',
  );
  assert.match(html, /\$\('ce-ev-by'\)\.value = savedBy\(\);/);
  assert.match(html, /\$\('ce-lr-by'\)\.value\.trim\(\) \|\| evBy\(\)/);
  assert.match(html, /\$\('ce-cy-by'\)\.value\.trim\(\) \|\| evBy\(\)/);
});

// 浏览器的「连本机」权限（Edge 146 实测：没允许时被挡）。nav 是假的：permissions.query 按名字回答
const navWith = (states) => ({
  permissions: {
    query: async ({ name }) => {
      if (!(name in states)) throw new TypeError('unknown permission');
      const v = states[name];
      return { state: typeof v === 'function' ? v() : v };
    },
  },
});
const okFetch = async () => ({
  ok: true,
  json: async () => ({ ok: true, version: '0.1.1', langs: ['ja'] }),
});
const failFetch = async () => Promise.reject(new TypeError('Failed to fetch'));

test('权限：先查 loopback-network，没有这个名字的浏览器是 unknown', async () => {
  assert.equal(await permissionState(navWith({ 'loopback-network': 'granted' })), 'granted');
  assert.equal(await permissionState(navWith({ 'local-network-access': 'denied' })), 'denied');
  assert.equal(await permissionState(navWith({})), 'unknown');
});

test('找助手：被浏览器挡住时说「不让连」，不说「没运行」；也不去请求', async () => {
  let asked = 0;
  const r = await locateHelper({
    nav: navWith({ 'loopback-network': 'denied' }),
    fetchImpl: async () => {
      asked++;
      return okFetch();
    },
  });
  assert.deepEqual([r.state, asked], ['denied', 0]);
});

test('找助手：浏览器正在问用户时先提示去点「允许」，并等得比平时久', async () => {
  let told = 0;
  let waited = 0;
  const slowOk = (url, opt) =>
    new Promise((res, rej) => {
      const t = setTimeout(() => res(okFetch()), 50);
      opt.signal.addEventListener('abort', () => {
        clearTimeout(t);
        rej(new Error('abort'));
      });
      waited = 1;
    });
  const r = await locateHelper({
    nav: navWith({ 'loopback-network': 'prompt' }),
    fetchImpl: slowOk,
    onAsk: () => told++,
    askMs: 2000,
  });
  assert.deepEqual([r.state, told, waited], ['ok', 1, 1]);
});

test('找助手：用户点了「拒绝」→ denied；权限没问题但连不上 → absent（请打开助手）', async () => {
  let st = 'prompt';
  const nav = navWith({ 'loopback-network': () => st });
  const denyThenFail = async () => {
    st = 'denied';
    throw new TypeError('Failed to fetch');
  };
  assert.equal((await locateHelper({ nav, fetchImpl: denyThenFail, askMs: 500 })).state, 'denied');
  assert.equal(
    (await locateHelper({ nav: navWith({ 'loopback-network': 'granted' }), fetchImpl: failFetch }))
      .state,
    'absent',
  );
  assert.equal((await locateHelper({ nav: navWith({}), fetchImpl: okFetch })).state, 'ok');
});

test('页面：用 locateHelper，三种结果各有说法；银行流水放进来时没有账户就登记', () => {
  const html = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing.html', import.meta.url)),
    'utf8',
  );
  assert.match(html, /locateHelper\(\{ onAsk:/);
  for (const k of [
    'ce_ev_helper_on',
    'ce_ev_helper_denied',
    'ce_ev_helper_off',
    'ce_ev_helper_ask',
  ])
    assert.ok(html.includes(`'${k}'`), k);
  assert.match(html, /evAsk\('register_bank', \[`bank\/\$\{name\}`\]/);
  const worker = fs.readFileSync(
    fileURLToPath(new URL('../solutions/demo/closing-worker.js', import.meta.url)),
    'utf8',
  );
  assert.match(worker, /'register_bank',/);
  const main = fs.readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
  for (const k of [
    'ce_bk_ok',
    'ce_bk_open_ok',
    'ce_bk_open_ng',
    'ce_bk_choose',
    'ce_bk_chain',
    'ce_bk_cols',
    'ce_z_bank_nobook',
    'ce_ev_helper_ask',
    'ce_ev_helper_denied',
  ])
    assert.equal(
      main.split(`
    ${k}:`).length - 1,
      3,
      `${k} 三语`,
    );
});
