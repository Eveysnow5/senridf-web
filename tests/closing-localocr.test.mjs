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
  assert.match(html, /findHelper\(\)/);
  assert.match(html, /lost = true;/);
  assert.match(html, /id="ce-ev-helper"/);
});

test('安全策略：connect-src 放行助手的地址', () => {
  const h = fs.readFileSync(fileURLToPath(new URL('../_headers', import.meta.url)), 'utf8');
  const csp = h.match(/^\s*Content-Security-Policy[^:]*:.*?(connect-src[^;]*)/m)[1]; // 头那一行（注释里也有这个词）
  assert.ok(csp.split(/\s+/).includes(HELPER), csp);
});
