import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCdnUrl,
  extractCdnLibs,
  classify,
  LIB_REGISTRY,
  ACKNOWLEDGED,
} from '../scripts/security/scan-cdn-libs.mjs';

// CDN 库 CVE 盯梢的**离线**测试（不打网络，网络那半在 workflow 里）。
// 守的是「监控自己别悄悄失效」：抽取坏了、有库没被映射（盲区）、豁免被写错。
// npm audit 看不见 CDN 脚本，这套是唯一在管它们的东西。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('parseCdnUrl 认得三种 CDN 格式', () => {
  assert.deepEqual(
    parseCdnUrl('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
    { cdnName: 'pdf.js', version: '3.11.174' },
  );
  assert.deepEqual(
    parseCdnUrl('https://cdn.jsdelivr.net/npm/dompurify@3.4.13/dist/purify.min.js'),
    { cdnName: 'dompurify', version: '3.4.13' },
  );
  assert.deepEqual(
    parseCdnUrl('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'),
    { cdnName: 'xlsx', version: '0.20.3' },
  );
  assert.equal(parseCdnUrl('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'), null);
});

test('★ 抽取真站点：非退化，且认出关键库', () => {
  const files = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f && !f.startsWith('tests/') && !f.startsWith('__preview'));
  const docs = files.map((f) => ({ file: f, html: readFileSync(path.join(ROOT, f), 'utf8') }));
  const libs = extractCdnLibs(docs);

  // 退化输入检查：抽取坏了会返回空/极少，绝不能当"没有库"。
  assert.ok(libs.length >= 3, `只抽到 ${libs.length} 个库，抽取多半坏了`);

  // ★ 关键库必须在（它们出过事，是这套监控的主要看护对象）。
  const names = new Set(libs.map((l) => l.cdnName));
  for (const must of ['pdf.js', 'xlsx']) {
    assert.ok(names.has(must), `没抽到 ${must} —— 抽取对它失效了`);
  }
});

test('★ 每个抽到的库都有 npm 映射（没有映射 = 不会被查 CVE = 盲区）', () => {
  const files = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f && !f.startsWith('tests/') && !f.startsWith('__preview'));
  const docs = files.map((f) => ({ file: f, html: readFileSync(path.join(ROOT, f), 'utf8') }));
  const libs = extractCdnLibs(docs);
  const unmapped = libs.filter((l) => !l.npm);
  assert.deepEqual(
    unmapped.map((l) => `${l.cdnName}@${l.version} (${l.file})`),
    [],
    '这些 CDN 库没进 LIB_REGISTRY，不会被查 CVE —— 去补映射',
  );
});

test('★ 未登记的 CDN 库必须标 npm=null（合成测试：守盲区检测的逻辑本身）', () => {
  // 直接喂一个 REGISTRY 里没有的库。它必须被标 null —— main() 靠 null 退 2 报盲区。
  // 光靠上面那条「真站点没有未映射库」测不出这个逻辑，因为当前恰好全都映射了。
  const docs = [
    {
      file: 'synthetic.html',
      html: '<script src="https://cdnjs.cloudflare.com/ajax/libs/somenewlib/1.0.0/x.min.js"></script>',
    },
  ];
  const nl = extractCdnLibs(docs).find((l) => l.cdnName === 'somenewlib');
  assert.ok(nl, '合成的未登记库没被抽到');
  assert.equal(nl.npm, null, '未登记的库必须标 null，否则盲区被吞（当作已覆盖）');
});

test('★ classify 按 CVE-id 精确豁免，不按库', () => {
  // 承认 pdf.js 的 CVE-2024-4367，不能顺带压住它将来的另一个 CVE。
  const results = [
    {
      npm: 'pdfjs-dist',
      cdnName: 'pdf.js',
      version: '3.11.174',
      vulns: [
        { id: 'GHSA-x', aliases: ['CVE-2024-4367'] }, // 已登记
        { id: 'GHSA-future', aliases: ['CVE-2099-99999'] }, // 未登记，必须仍然报
      ],
    },
  ];
  const { unacknowledged, acknowledged } = classify(results);
  assert.equal(acknowledged.length, 1);
  assert.equal(acknowledged[0].aliases[0], 'CVE-2024-4367');
  assert.equal(unacknowledged.length, 1, '同一个库的新 CVE 必须照报');
  assert.equal(unacknowledged[0].aliases[0], 'CVE-2099-99999');
});

test('classify：GHSA id 或 CVE 别名任一命中豁免都算已登记', () => {
  // ACKNOWLEDGED 里写的是 CVE 号，但 OSV 主 id 常是 GHSA——要能通过别名匹配。
  const results = [
    {
      npm: 'xlsx',
      cdnName: 'xlsx',
      version: '0.20.3',
      vulns: [{ id: 'GHSA-4r6h-8v6p-xvw6', aliases: ['CVE-2023-30533'] }],
    },
  ];
  const { unacknowledged, acknowledged } = classify(results);
  assert.equal(unacknowledged.length, 0);
  assert.equal(acknowledged.length, 1);
});

test('★ 干净的库不产生任何 finding', () => {
  const { unacknowledged, acknowledged } = classify([
    { npm: 'marked', cdnName: 'marked', version: '12.0.2', vulns: [] },
  ]);
  assert.equal(unacknowledged.length, 0);
  assert.equal(acknowledged.length, 0);
});

test('每条豁免都写了理由（无理由的豁免 = 把漏洞藏起来）', () => {
  for (const a of ACKNOWLEDGED) {
    assert.ok(a.npm && a.cve, `豁免缺 npm/cve：${JSON.stringify(a)}`);
    assert.ok(a.reason && a.reason.length > 15, `${a.npm} ${a.cve} 的豁免理由太短或缺失`);
    assert.match(a.cve, /^CVE-\d{4}-\d+$/, `${a.cve} 不像 CVE 号`);
  }
});

test('LIB_REGISTRY 里没有明显笔误（值都像 npm 包名）', () => {
  for (const [cdn, npm] of Object.entries(LIB_REGISTRY)) {
    assert.ok(/^[a-z0-9@/._-]+$/i.test(npm), `${cdn} → ${npm} 不像 npm 包名`);
  }
});
