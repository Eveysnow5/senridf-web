/* 月结引擎的 Web Worker（solutions/demo/closing.html 用）。
 *
 * 为什么放在 Worker 里：结账是同步的 Python 计算，放在页面主线程时整页冻结、连「计算中」都画不出来，
 * 用户会以为卡死（作者 2026-10-09）。放到 Worker 后主线程空闲，进度条和计时可以实时更新。
 *
 * 数据：公司文件只写进 Pyodide 的内存文件系统，不发任何网络请求。
 * 网络只有三类：Pyodide 运行时（jsdelivr，wasm/标准库/pyyaml）、本站的引擎包与 wheel、本站的 pyodide.js。
 * pyodide.js 放在本站而不是 CDN：Worker 的 importScripts 不能带 SRI，所以由构建脚本核对公开版哈希后同源发布，
 * 这里再按 manifest 的 sha256 核对一次。
 *
 * 消息（页面 → Worker）：{cmd:'init'} / {cmd:'precheck', files, month} / {cmd:'run', source, month, lang, today}
 * 消息（Worker → 页面）：{type:'stage', stage} / {type:'progress', stage, i, n, label}
 *                       / {type:'precheck', result} / {type:'result', result, xlsx} / {type:'error', kind, message}
 */
'use strict';

const ENGINE = 'closing-engine/';
const ROOT = '/opt/jpclose';
const WORK = '/work/company';
let py = null;
let manifest = null;

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

class BundleError extends Error {}

async function fetchChecked(name, sha) {
  const r = await fetch(ENGINE + name, { cache: 'no-cache' });
  if (!r.ok) throw new BundleError(name);
  const buf = await r.arrayBuffer();
  if ((await sha256Hex(buf)) !== sha) throw new BundleError(name);
  return buf;
}

async function init() {
  if (py) return py;
  post({ type: 'stage', stage: 'runtime' });
  manifest = await (await fetch(ENGINE + 'manifest.json', { cache: 'no-cache' })).json();
  // 引擎包、wheel、加载器都按 manifest 的 sha256 校验：部署到一半或缓存串版时停下，而不是跑出错的数
  await fetchChecked(manifest.loader.name, manifest.loader.sha256);
  importScripts(ENGINE + manifest.loader.name);
  const p = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${manifest.pyodide}/full/`,
  });
  post({ type: 'stage', stage: 'packages' });
  await p.loadPackage(['micropip', 'pyyaml']);
  post({ type: 'stage', stage: 'engine' });
  const zip = await fetchChecked(manifest.bundle.name, manifest.bundle.sha256);
  p.unpackArchive(zip, 'zip', { extractDir: ROOT });
  p.FS.mkdirTree('/wheels');
  for (const w of manifest.wheels) {
    const buf = await fetchChecked(`wheels/${w.name}`, w.sha256);
    p.FS.writeFile(`/wheels/${w.name}`, new Uint8Array(buf));
  }
  await p.runPythonAsync(`
import micropip, sys, os
await micropip.install(["emfs:/wheels/" + n for n in sorted(os.listdir("/wheels"))], deps=False)
sys.path.insert(0, "${ROOT}/src")
import jpclose.web
`);
  py = p;
  post({ type: 'stage', stage: 'ready' });
  return p;
}

function rmTree(p, dir) {
  if (!p.FS.analyzePath(dir).exists) return;
  for (const name of p.FS.readdir(dir)) {
    if (name === '.' || name === '..') continue;
    const full = `${dir}/${name}`;
    if (p.FS.isDir(p.FS.stat(full).mode)) rmTree(p, full);
    else p.FS.unlink(full);
  }
  p.FS.rmdir(dir);
}

// files: [{path: 'company.yaml' / 'bank/x.csv'（已去掉文件夹本身的名字）, buf: ArrayBuffer}]
function writeCompany(p, files) {
  rmTree(p, WORK);
  p.FS.mkdirTree(WORK);
  for (const f of files) {
    const parts = f.path.split('/');
    if (!parts.length || parts.some((s) => s === '..' || s === '' || s === '.')) continue;
    if (parts.length > 1) p.FS.mkdirTree(`${WORK}/${parts.slice(0, -1).join('/')}`);
    p.FS.writeFile(`${WORK}/${parts.join('/')}`, new Uint8Array(f.buf));
  }
}

function callPy(p, args, code) {
  p.globals.set('ce_args', p.toPy(args));
  return JSON.parse(p.runPython(code));
}

const PRECHECK = `
import json, jpclose.web
json.dumps(jpclose.web.precheck(*ce_args), ensure_ascii=False, default=str)
`;
const RUN = `
import json, traceback, jpclose.web
try:
    _r = jpclose.web.run(*ce_args, progress=ce_progress)
except Exception as _e:
    _r = dict(ok=False, kind="runtime", error=f"{type(_e).__name__}: {_e}", trace=traceback.format_exc())
json.dumps(_r, ensure_ascii=False, default=str)
`;

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    const p = await init();
    if (m.cmd === 'precheck') {
      writeCompany(p, m.files);
      post({ type: 'precheck', result: callPy(p, [WORK, m.month], PRECHECK) });
    } else if (m.cmd === 'run') {
      const dir = m.source === 'upload' ? WORK : `${ROOT}/samples/${m.source}_sample`;
      const out = '/tmp/workpaper.xlsx';
      if (p.FS.analyzePath(out).exists) p.FS.unlink(out);
      p.globals.set('ce_progress', (stage, i, n, label) =>
        post({ type: 'progress', stage, i, n, label }),
      );
      const r = callPy(p, [dir, m.month, m.today, m.lang, out], RUN);
      if (r.trace) console.error(r.trace);
      if (r.error) {
        post({ type: 'result', result: r });
        return;
      }
      const bytes = p.FS.readFile(out);
      post({ type: 'result', result: r, xlsx: bytes }, [bytes.buffer]);
    }
  } catch (err) {
    console.error(err);
    post({
      type: 'error',
      kind: err instanceof BundleError ? 'bundle' : 'runtime',
      message: String((err && err.message) || err),
    });
  }
};
