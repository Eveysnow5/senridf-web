/* 证凭的 OCR（在浏览器里跑，照片不出这台电脑）。module Worker：closing.html 用 new Worker(url, { type: 'module' }) 起。
 *
 * 模型：PP-OCRv5 mobile（中日英一个模型），文件放在本站 closing-engine/ocr/，载入后先核对 ocr.json 里的 sha256，
 * 不一致就不用（防止半截下载、被替换）。onnxruntime 的 wasm 本体超过 Cloudflare Pages 的 25 MiB，
 * 和 Pyodide 一样从 jsDelivr 的固定版本读（ocr.json 的 ort_wasm）。
 *
 * 速度（作者的笔记本 Intel HD 620，2026-10-10 实测 35 页）：WebGPU 每页 8–39 秒，平均 18 秒；
 * 没有 WebGPU 时用 WASM，每页 30–90 秒。所以一页一页地识别、识别完一页先回一页。
 * 参数是对实在的 35 页调的：逐框识别（per-box）、检测分辨率提高到长边 2560——默认值（按行合并、长边 ≤1920）
 * 在这些照片上漏字很多（「厚生労働省」读成「厚生 省」）。横着拍的页几乎读不出字时，转 90°/270° 再读。
 *
 * 消息：{cmd:'init'} → {type:'ready', ep}；{cmd:'ocr', id, image: ImageBitmap} → {type:'ocr', id, lines, ms, turned}
 */
const BASE = new URL('closing-engine/ocr/', self.location.href).href;
let svc = null;
let ep = '';

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function load(manifest, name) {
  const buf = await (await fetch(BASE + name)).arrayBuffer();
  const want = manifest.files[name].sha256;
  if ((await sha256(buf)) !== want)
    throw new Error(`OCR 模型 ${name} 的 sha256 不一致（下载不完整或被替换）`);
  return buf;
}

async function init() {
  if (svc) return;
  const manifest = await (await fetch(BASE + 'ocr.json', { cache: 'no-cache' })).json();
  const { PaddleOcrService, ort } = await import(BASE + 'ocr-bundle.mjs');
  ort.env.wasm.wasmPaths = manifest.ort_wasm;
  const [det, rec, dict] = await Promise.all(
    ['det.onnx', 'rec.onnx', 'rec.dict.txt'].map((n) => load(manifest, n)),
  );
  // 不用显卡（WebGPU）：2026-10-15 作者报告，识别一开始电脑就被占几个小时，浏览器和别的程序都打不开——
  // 笔记本的集成显卡被占满时整个系统的界面都会卡住。只用 CPU 的一个核（WASM 单线程）：慢一些，但电脑还能用
  const gpu = false;
  ep = 'wasm';
  svc = new PaddleOcrService({
    model: { detection: det, recognition: rec, charactersDictionary: dict },
    session: { executionProviders: gpu ? ['webgpu', 'wasm'] : ['wasm'] },
    detection: { maxSideLength: 2560 },
    recognition: { strategy: 'per-box', maxCropSourceSideLength: 4000, minimumConfidence: 0.3 },
  });
  await svc.initialize();
}

async function read(canvas) {
  const r = await svc.recognize(canvas, { noCache: true });
  const text = r.text ?? (r.lines || []).map((l) => l.map((w) => w.text).join(' ')).join('\n');
  return text.split('\n');
}

function rotated(bmp, deg) {
  const c = new OffscreenCanvas(bmp.height, bmp.width);
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2);
  x.rotate((deg * Math.PI) / 180);
  x.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return c;
}

const size = (lines) => lines.join('').replace(/\s/g, '').length;

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    await init();
    if (m.cmd === 'init') {
      self.postMessage({ type: 'ready', ep });
      return;
    }
    if (m.cmd === 'ocr') {
      const t0 = performance.now();
      const bmp = m.image;
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, 0, 0);
      let lines = await read(c);
      let turned = 0;
      if (size(lines) < 40) {
        for (const deg of [90, 270]) {
          const t = await read(rotated(bmp, deg));
          if (size(t) > size(lines)) {
            lines = t;
            turned = deg;
          }
        }
      }
      bmp.close();
      self.postMessage({
        type: 'ocr',
        id: m.id,
        lines,
        turned,
        ms: Math.round(performance.now() - t0),
        ep,
      });
    }
  } catch (err) {
    console.error(err);
    self.postMessage({ type: 'error', id: m.id, message: String((err && err.message) || err) });
  }
};
