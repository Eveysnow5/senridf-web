// 交接包（solutions/demo/closing-handoff.mjs）：客户打包 → 税理士导入。
// 对照用 Python 自带的 zipfile（独立实现）：我们写的包它读得出、它写的只存储包我们读得出；
// 它造的坏包（压缩过・路径越界）我们不收。没有 Python 的环境跳过这几条（CI 的 ubuntu 有 python3）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  compare,
  crc32,
  folderName,
  MANIFEST,
  pack,
  readZip,
  safePath,
  sha256hex,
  unpack,
  writeZip,
} from '../solutions/demo/closing-handoff.mjs';

const enc = (s) => new TextEncoder().encode(s);
const FILES = [
  { path: '公司资料.xlsx', buf: Uint8Array.from([0x50, 0x4b, 3, 4, 0, 255, 128]) },
  { path: 'bank/三井住友_2026-08.csv', buf: enc('日付,摘要,出金\n2026/08/01,ﾃｽｳﾘﾖｳ,440\n') },
  {
    path: 'evidence/2026-08/領収書 1.pdf',
    buf: new Uint8Array(70000).map((_, i) => (i * 31) % 256),
  },
  { path: '结账结果/2026-08/空.txt', buf: new Uint8Array(0) },
];
const META = { company: '架空商事', month: '2026-08', packed_by: '担当A' };

const PY = (() => {
  for (const c of ['python3', 'python']) {
    try {
      execFileSync(c, ['-c', 'import zipfile'], { stdio: 'ignore' });
      return c;
    } catch {
      /* 下一个 */
    }
  }
  return null;
})();
const py = (code, ...args) =>
  execFileSync(PY, ['-c', code, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });

test('crc32 / sha256：已知值', async () => {
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
  assert.equal(
    await sha256hex(enc('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('打包 → 解包：路径・字节一样，交接单记着每个文件的指纹和摘要', async () => {
  const { zip, manifest } = await pack(FILES, META, new Date('2026-09-05T10:00:00'));
  assert.equal(manifest.company, '架空商事');
  assert.equal(manifest.files.length, FILES.length);
  assert.equal(manifest.files[1].sha256, await sha256hex(FILES[1].buf));
  const got = await unpack(zip);
  assert.deepEqual(
    got.files.map((f) => f.path),
    FILES.map((f) => f.path),
  );
  for (const [i, f] of got.files.entries()) assert.deepEqual([...f.buf], [...FILES[i].buf]);
  assert.equal(got.manifest.month, '2026-08');
});

test('坏了一个字节：不收（crc）', async () => {
  const { zip } = await pack(FILES, META);
  const bad = zip.slice();
  const at = bad.length - 1000; // 凭证 PDF 的中间（中央目录在最后几百字节）
  bad[at - 30000] ^= 1;
  assert.throws(() => readZip(bad), /crc/);
  await assert.rejects(unpack(bad), /crc/);
});

test('文件被换了但交接单没变：不收（mismatch，说出是哪个文件）', async () => {
  const { manifest } = await pack(FILES, META);
  const swapped = FILES.map((f) =>
    f.path.startsWith('bank/') ? { ...f, buf: enc('改过的流水') } : f,
  );
  const zip = writeZip([{ path: MANIFEST, buf: enc(JSON.stringify(manifest)) }, ...swapped]);
  await assert.rejects(
    unpack(zip),
    (e) => e.message === 'mismatch' && e.detail.changed[0] === 'bank/三井住友_2026-08.csv',
  );
  const dropped = writeZip([
    { path: MANIFEST, buf: enc(JSON.stringify(manifest)) },
    ...FILES.slice(1),
  ]);
  await assert.rejects(
    unpack(dropped),
    (e) => e.message === 'mismatch' && e.detail.missing[0] === '公司资料.xlsx',
  );
});

test('不是交接包：没有交接单・不是 zip', async () => {
  assert.throws(() => readZip(enc('hello')), /not_zip/);
  await assert.rejects(unpack(writeZip(FILES)), /no_manifest/);
  await assert.rejects(unpack(writeZip([{ path: MANIFEST, buf: enc('{') }])), /bad_manifest/);
});

test('路径：越界・盘符・反斜杠・绝对路径不收', () => {
  for (const p of ['../evil.txt', 'a/../../b', '/etc/x', 'C:/x', 'a\\b', 'a//b', './a', ''])
    assert.equal(safePath(p), false, p);
  for (const p of ['公司资料.xlsx', 'evidence/2026-08/領収書 1.pdf', '结账结果/备份/x'])
    assert.equal(safePath(p), true, p);
  assert.throws(() => writeZip([{ path: '../x', buf: enc('x') }]), /bad_path/);
});

test('公司名做文件夹名：Windows 不能用的字换掉', () => {
  assert.equal(folderName('株式会社 A/B:C?'), '株式会社 A_B_C_');
  assert.equal(folderName('末尾の点. '), '末尾の点');
  assert.equal(folderName(''), '_');
});

test('对照：多出来的・缺的・改过的', async () => {
  const { manifest } = await pack(FILES, META);
  const now = [
    ...FILES.slice(1, 3),
    { path: '新的.txt', buf: enc('x') },
    { ...FILES[3], buf: enc('有字了') },
  ];
  const d = await compare(manifest, now);
  assert.deepEqual(d, {
    changed: ['结账结果/2026-08/空.txt'],
    missing: ['公司资料.xlsx'],
    extra: ['新的.txt'],
  });
});

test(
  'Python 的 zipfile 读得出我们的包（文件名・内容・CRC）',
  { skip: !PY && '没有 Python' },
  async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'handoff-'));
    try {
      const { zip } = await pack(FILES, META);
      const f = path.join(dir, 'p.zip');
      writeFileSync(f, zip);
      const out = JSON.parse(
        py(
          'import zipfile,sys,json,hashlib;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps([[i.filename,hashlib.sha256(z.read(i)).hexdigest(),i.flag_bits&0x800] for i in z.infolist()],ensure_ascii=False))',
          f,
        ),
      );
      assert.equal(out[0][0], MANIFEST);
      for (const [i, x] of FILES.entries()) {
        assert.equal(out[i + 1][0], x.path);
        assert.equal(out[i + 1][1], await sha256hex(x.buf));
        assert.equal(out[i + 1][2], 0x800);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  'Python 写的包：只存储的读得出；压缩过的・路径越界的不收',
  { skip: !PY && '没有 Python' },
  () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'handoff-'));
    try {
      const mk = (name, method, arc) => {
        const f = path.join(dir, name);
        py(
          `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1],'w',zipfile.${method});z.writestr(sys.argv[2],'中身'*50);z.close()`,
          f,
          arc,
        );
        return readFileSync(f);
      };
      const ok = readZip(mk('s.zip', 'ZIP_STORED', 'フォルダ/a.txt'));
      assert.equal(ok[0].path, 'フォルダ/a.txt');
      assert.equal(new TextDecoder().decode(ok[0].buf), '中身'.repeat(50));
      assert.throws(() => readZip(mk('d.zip', 'ZIP_DEFLATED', 'a.txt')), /compressed/);
      assert.throws(() => readZip(mk('e.zip', 'ZIP_STORED', '../evil.txt')), /bad_path/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
