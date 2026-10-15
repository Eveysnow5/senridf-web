/* 本机识别助手（Windows 自带的文字识别）——月结页面的证凭识别的快路。
 *
 * 浏览器里的识别（closing-ocr-worker.js，PaddleOCR）一页 30–60 秒，开显卡时整台电脑卡住（作者 2026-10-15）。
 * Windows 自带的识别一页约 1 秒、几乎不占资源，但浏览器调用不了它：客户在电脑上运行一个小程序
 * （自动化结账工具 product/helper/ocr-helper.ps1），它只在 127.0.0.1 上听。页面找得到它就用它，找不到就退回浏览器识别。
 *
 * 小程序故意做得很薄（图片 → 每个字和位置）。把字拼成行在这里做：要反复调的东西放在网页上，客户不用重装。
 *
 * 参数是对作者的 35 页扫描件（答案卷 29 张有模板的单据）量出来的（2026-10-15）：
 *   - 长边 4500 像素（3000：4 张对；4500：10 张；6000：不再变好、时间翻倍）
 *   - 先在页面转灰度（0.299/0.587/0.114）再交给它。小程序自己转、或者交彩色：7 张。JPEG 质量 0.9 和 PNG 一样
 *   - Windows 把日文的每个字当成一个「词」，字之间都有空格（「領 収 済 通 知 書」）。按字的间距拼回去：
 *     间距大于字高才留空格；数字之间放宽到 1.5 倍（淡的千分位逗号会留下空隙：「5 538」）
 *   - 同一高度、左右分开的几块拼成一行（PaddleOCR 的输出就是这样，模板是照它写的）
 */
export const HELPER = 'http://127.0.0.1:47611';
export const LONG_SIDE = 4500;
export const JPEG_QUALITY = 0.9;
const GAP = 1.0;
const GAP_DIGITS = 1.5;
const FIX = { '′': ',' }; // Windows 常把千分位逗号读成「′」（「1′551円」）

/** 找本机识别助手。找不到（没运行、浏览器不让连本机）就是 null，不报错。 */
export async function findHelper(fetchImpl = fetch, ms = 1200) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetchImpl(`${HELPER}/ping`, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? { version: String(j.version || ''), langs: j.langs || [] } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 一页图片（JPEG Blob）交给助手，返回拼好的行。 */
export async function helperRead(blob, lang = 'ja', fetchImpl = fetch) {
  const r = await fetchImpl(`${HELPER}/ocr?lang=${encodeURIComponent(lang)}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j && j.error ? j.error : `helper ${r.status}`);
  return { lines: toLines(j.lines || []), ms: j.ms, turned: j.turned || 0 };
}

/** RGBA 像素就地转灰度：和 Python 的 PIL convert('L') 逐个像素相同（参数是用它量的）。 */
export function toGray(data) {
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] * 19595 + data[i + 1] * 38470 + data[i + 2] * 7471 + 0x8000) >> 16;
    data[i] = data[i + 1] = data[i + 2] = g;
  }
  return data;
}

const isDigit = (c) => c >= '0' && c <= '9';
const isLatin = (c) => /^[A-Za-z]$/.test(c);

/** 一行里的「词」按间距拼起来。words: [{t, b:[x,y,w,h]}] */
export function joinWords(words) {
  const ws = [...words].sort((a, b) => a.b[0] - b.b[0]);
  let out = '';
  let prev = null;
  for (const w of ws) {
    if (prev) {
      const gap = w.b[0] - (prev.b[0] + prev.b[2]);
      const h = Math.max(w.b[3], prev.b[3]);
      const a = prev.t.slice(-1);
      const c = w.t.slice(0, 1);
      const lim = isDigit(a) && isDigit(c) ? GAP_DIGITS : GAP;
      if (gap > lim * h || (isLatin(a) && isLatin(c))) out += ' ';
    }
    out += w.t;
    prev = w;
  }
  return out.replace(/./gu, (ch) => FIX[ch] || ch);
}

/** 助手返回的行 [{words}] → 文字行：先拼每行，再把同一高度的几块从左到右并成一行。 */
export function toLines(raw) {
  const items = [];
  for (const l of raw) {
    const ws = (l.words || []).filter((w) => w && w.t && Array.isArray(w.b));
    if (!ws.length) continue;
    const y0 = Math.min(...ws.map((w) => w.b[1]));
    const y1 = Math.max(...ws.map((w) => w.b[1] + w.b[3]));
    const x0 = Math.min(...ws.map((w) => w.b[0]));
    items.push({ t: joinWords(ws), x: x0, cy: (y0 + y1) / 2, h: y1 - y0 });
  }
  items.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const it of items) {
    const r = rows.find((row) => Math.abs(it.cy - row.cy) < 0.5 * Math.min(it.h, row.h));
    if (r) r.items.push(it);
    else rows.push({ cy: it.cy, h: it.h, items: [it] });
  }
  return rows.map((r) =>
    r.items
      .sort((a, b) => a.x - b.x)
      .map((x) => x.t)
      .join(' '),
  );
}
