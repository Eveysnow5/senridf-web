// 客户 → 税理士的交接包（作者 2026-10-23：不经过服务器，打包・解压都在浏览器里）。
//
// 包＝只存储（不压缩）的 zip。照片・PDF・xlsx 本身已经压过，再压几乎不变小；只存储的格式几十行就能写和读，
// 不用外部库。文件名用 UTF-8（标志位 11），Windows 的资源管理器也能直接解开。
// 包里多一个 handoff.json：每个文件的 sha256・字节数，加上这次结账的摘要（月份・没通过的检查・待确认的条数）。
// 税理士导入时逐个文件对指纹：对不上（中途被改・传坏）就不收。
//
// 读包只认自己写的形状（只存储・不加密・不分卷）。别的工具重新压过的包会被拒（说清是为什么），
// 而不是猜着解。路径里有「..」・盘符・反斜杠・绝对路径的，一律不收（防止写到文件夹外面）。

export const MANIFEST = 'handoff.json';
export const FORMAT = 1;
const MAX_ENTRIES = 0xffff;
const MAX_BYTES = 0xffffffff;

let CRC_TABLE = null;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function sha256hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 包里允许的路径：相对路径、用「/」分隔、没有空段・「.」「..」・盘符・反斜杠・控制字符
export function safePath(p) {
  if (typeof p !== 'string' || !p || p.length > 500) return false;
  if (p.startsWith('/') || p.includes('\\') || p.includes(':') || /[\u0000-\u001f]/.test(p))
    return false;
  return p.split('/').every((s) => s && s !== '.' && s !== '..');
}

const u8 = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b));

function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date =
    ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

// files：[{path, buf}]（buf 是 ArrayBuffer 或 Uint8Array）。返回 zip 的字节。
export function writeZip(files, when = new Date()) {
  if (files.length > MAX_ENTRIES) throw new Error('too_many');
  const enc = new TextEncoder();
  const [time, date] = dosTime(when);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    if (!safePath(f.path)) throw new Error(`bad_path:${f.path}`);
    const name = enc.encode(f.path);
    const data = u8(f.buf);
    if (data.length > MAX_BYTES || offset > MAX_BYTES) throw new Error('too_big');
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 10, true); // version needed：1.0（只存储）
    h.setUint16(6, 0x0800, true); // UTF-8 的文件名
    h.setUint16(8, 0, true); // 只存储
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 10, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  if (offset + cdSize > MAX_BYTES) throw new Error('too_big');
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true);
  e.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const b of all) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

// zip 的字节 → [{path, buf}]。读不了时抛 Error，message 是原因的代号：
//   not_zip（不是 zip）・compressed（被别的工具压缩过）・encrypted・bad_path・crc（内容坏了）・truncated
export function readZip(bytes) {
  const b = u8(bytes);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not_zip');
  const n = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8', { fatal: true });
  const out = [];
  for (let k = 0; k < n; k++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) throw new Error('truncated');
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true);
    const xl = v.getUint16(p + 30, true);
    const cl = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    let path;
    try {
      path = dec.decode(b.subarray(p + 46, p + 46 + nl));
    } catch {
      throw new Error('bad_path');
    }
    p += 46 + nl + xl + cl;
    if (path.endsWith('/') && size === 0) continue; // 文件夹的条目
    if (flags & 1) throw new Error('encrypted');
    if (method !== 0 || size !== usize) throw new Error('compressed');
    if (!safePath(path)) throw new Error('bad_path');
    if (local + 30 > b.length || v.getUint32(local, true) !== 0x04034b50)
      throw new Error('truncated');
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    if (start + size > b.length) throw new Error('truncated');
    const data = b.slice(start, start + size);
    if (crc32(data) !== crc) throw new Error('crc');
    out.push({ path, buf: data });
  }
  return out;
}

// 打包：files＝工作文件夹里要交出去的文件，meta＝结账的摘要等（写进 handoff.json）
export async function pack(files, meta, when = new Date()) {
  const list = [];
  for (const f of files) {
    if (f.path === MANIFEST) continue;
    const data = u8(f.buf);
    list.push({ path: f.path, bytes: data.length, sha256: await sha256hex(data) });
  }
  const manifest = { format: FORMAT, packed_at: when.toISOString(), ...meta, files: list };
  const mbytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  return {
    zip: writeZip(
      [{ path: MANIFEST, buf: mbytes }, ...files.filter((f) => f.path !== MANIFEST)],
      when,
    ),
    manifest,
  };
}

// 对照：手里的文件（[{path, buf}]）和交接单（manifest.files）。返回 {changed, missing, extra}（路径的列表）
export async function compare(manifest, files) {
  const have = new Map(files.filter((f) => f.path !== MANIFEST).map((f) => [f.path, f]));
  const changed = [];
  const missing = [];
  for (const m of manifest.files || []) {
    const f = have.get(m.path);
    if (!f) missing.push(m.path);
    else {
      const data = u8(f.buf);
      if (data.length !== m.bytes || (await sha256hex(data)) !== m.sha256) changed.push(m.path);
      have.delete(m.path);
    }
  }
  return { changed, missing, extra: [...have.keys()] };
}

// 解包：zip 的字节 → {manifest, files}。不是交接包・指纹对不上 → 抛 Error（message 是代号）：
//   no_manifest・bad_manifest・mismatch（附 detail：{changed, missing, extra}）＋ readZip 的代号
export async function unpack(bytes) {
  const all = readZip(bytes);
  const m = all.find((f) => f.path === MANIFEST);
  if (!m) throw new Error('no_manifest');
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(m.buf));
  } catch {
    throw new Error('bad_manifest');
  }
  if (!manifest || manifest.format !== FORMAT || !Array.isArray(manifest.files))
    throw new Error('bad_manifest');
  const files = all.filter((f) => f.path !== MANIFEST);
  const diff = await compare(manifest, files);
  if (diff.changed.length || diff.missing.length || diff.extra.length) {
    const e = new Error('mismatch');
    e.detail = diff;
    throw e;
  }
  return { manifest, files };
}

// 文件夹名里不能用的字（Windows）换成「_」；公司名做税理士那边的文件夹名
export function folderName(s) {
  const t = String(s || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim();
  return t.slice(0, 80) || '_';
}
