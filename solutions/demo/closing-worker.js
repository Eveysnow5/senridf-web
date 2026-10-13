/* 月结引擎的 Web Worker（solutions/demo/closing.html 用）。
 *
 * 为什么放在 Worker 里：结账是同步的 Python 计算，放在页面主线程时整页冻结、连「计算中」都画不出来，
 * 用户会以为卡死（作者 2026-10-09）。放到 Worker 后主线程空闲，进度条和计时可以实时更新。
 *
 * 数据：公司文件只写进 Pyodide 的内存文件系统，不发任何网络请求。
 * 网络只有三类：Pyodide 运行时（jsdelivr，wasm/标准库/pyyaml）、本站的引擎包与 wheel、本站的 pyodide.mjs。
 * pyodide.mjs 放在本站而不是 CDN：Worker 里的 import() 不能带 SRI，所以由构建脚本核对公开版哈希后同源发布，
 * 这里再按 manifest 的 sha256 核对一次。
 *
 * 必须是 module Worker（closing.html 用 new Worker(url, { type: 'module' }) 起）：这一版 Pyodide 不支持经典 Worker，
 * 加载器用「importScripts('data:…') 能不能成功」来判断，能成功就直接抛错。CSP 强制拦截时那一句被拦下、
 * 判断失灵，经典 Worker 反而能跑——而线上的 CSP 只是 Report-Only。2026-10-11 之前的浏览器实测全在强制拦截的
 * 预览环境里做，所以一直是绿的，线上却是坏的。tests/closing-worker-module.test.mjs 钉住这一条。
 *
 * 消息（页面 → Worker）：{cmd:'init'} / {cmd:'precheck', files, month, ui}
 *                       / {cmd:'run', source, month, lang, today, answers, ui, edits}
 * 消息（Worker → 页面）：{type:'stage', stage} / {type:'progress', stage, i, n, label}
 *                       / {type:'precheck', result} / {type:'result', result, xlsx, book} / {type:'error', kind, message}
 */
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

// 初始化只做一次。连接文件夹时页面会同时发「检查资料」和「读证凭索引」两个请求：各自 await init() 的话，
// 运行环境会被装两遍、互相踩，卡在「正在加载组件」（2026-10-11 用真实的文件夹接口实测发现）。
// 所以记住的是那个 Promise，不是结果；失败了清掉，下一次请求可以重来。
let initing = null;
function init() {
  if (!initing)
    initing = load().catch((err) => {
      initing = null;
      throw err;
    });
  return initing;
}

async function load() {
  if (py) return py;
  post({ type: 'stage', stage: 'runtime' });
  manifest = await (await fetch(ENGINE + 'manifest.json', { cache: 'no-cache' })).json();
  // 引擎包、wheel、加载器都按 manifest 的 sha256 校验：部署到一半或缓存串版时停下，而不是跑出错的数
  await fetchChecked(manifest.loader.name, manifest.loader.sha256);
  const { loadPyodide } = await import(
    new URL(ENGINE + manifest.loader.name, self.location.href).href
  );
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
json.dumps(jpclose.web.precheck(ce_args[0], ce_args[1], ui=ce_args[2], month_from=ce_args[3]),
           ensure_ascii=False, default=str)
`;
const RUN = `
import json, traceback, jpclose.web
try:
    _r = jpclose.web.run(*ce_args[:5], progress=ce_progress, answers=ce_args[5], ui=ce_args[6], edits=ce_args[7],
                         month_from=ce_args[8])
except Exception as _e:
    _r = dict(ok=False, kind="runtime", error=f"{type(_e).__name__}: {_e}", trace=traceback.format_exc())
json.dumps(_r, ensure_ascii=False, default=str)
`;

// 期间内别的月份的底稿：用上一次 run 留下的账（jpclose.web._LAST），不重新结账
const WORKPAPER = `
import json, jpclose.web
json.dumps(jpclose.web.month_workpaper(ce_args[0], ce_args[1], ce_args[2]), ensure_ascii=False, default=str)
`;

// 证凭（索引簿）：op 是 jpclose.webev 的函数名，args 跟在公司目录后面。返回改过的索引簿文本（files），
// 页面写回文件夹。原件（照片・PDF）页面直接写进文件夹，不进这里
const EVIDENCE_OPS = new Set([
  'path',
  'add',
  'confirm',
  'void',
  'attach',
  'listing',
  'classify',
  'preview',
  'import_opening',
]);
const EVIDENCE = `
import json, jpclose.webev as _w
_op, _args = ce_args[0], list(ce_args[1])
_r = _w.path(*_args) if _op == "path" else getattr(_w, _op)(ce_args[2], *_args)
json.dumps(_r, ensure_ascii=False, default=str)
`;

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.cmd === 'evidence') {
    try {
      const p = await init();
      if (!EVIDENCE_OPS.has(m.op)) throw new Error(`unknown evidence op ${m.op}`);
      if (m.files) writeCompany(p, m.files);
      post({ type: 'evidence', id: m.id, result: callPy(p, [m.op, m.args || [], WORK], EVIDENCE) });
    } catch (err) {
      console.error(err);
      post({
        type: 'evidence',
        id: m.id,
        result: { ok: false, error: String((err && err.message) || err) },
      });
    }
    return;
  }
  try {
    const p = await init();
    if (m.cmd === 'precheck') {
      writeCompany(p, m.files);
      post({
        type: 'precheck',
        result: callPy(p, [WORK, m.month, m.ui || 'ja', m.month_from || null], PRECHECK),
      });
    } else if (m.cmd === 'run') {
      const dir = m.source === 'upload' ? WORK : `${ROOT}/samples/${m.source}_sample`;
      const out = '/tmp/workpaper.xlsx';
      if (p.FS.analyzePath(out).exists) p.FS.unlink(out);
      p.globals.set('ce_progress', (stage, i, n, label) =>
        post({ type: 'progress', stage, i, n, label }),
      );
      // answers：画面で入力した回答、edits：画面で直した待処理の値（無ければ null）。ui：画面の言語（エラーの訳に使う）
      const r = callPy(
        p,
        [
          dir,
          m.month,
          m.today,
          m.lang,
          out,
          m.answers || null,
          m.ui || 'ja',
          m.edits || null,
          m.month_from || null,
        ],
        RUN,
      );
      if (r.trace) console.error(r.trace);
      if (r.error) {
        post({ type: 'result', result: r });
        return;
      }
      const bytes = p.FS.readFile(out);
      const transfer = [bytes.buffer];
      let book = null;
      if (r.book_path) {
        book = p.FS.readFile(r.book_path); // 回答を書き込んだ公司资料.xlsx
        transfer.push(book.buffer);
      }
      post({ type: 'result', result: r, xlsx: bytes, book }, transfer);
    } else if (m.cmd === 'workpaper') {
      const out = `/tmp/workpaper_${m.month}.xlsx`;
      const r = callPy(p, [m.month, m.lang, out], WORKPAPER);
      if (r.error) {
        post({ type: 'workpaper', result: r });
        return;
      }
      const bytes = p.FS.readFile(out);
      p.FS.unlink(out);
      post({ type: 'workpaper', result: r, xlsx: bytes }, [bytes.buffer]);
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
