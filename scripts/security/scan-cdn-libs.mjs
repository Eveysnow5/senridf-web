// 盯梢页面里用 <script src> 从 CDN 引入的前端库有没有已知 CVE。
//
// ── 为什么需要它（2026-09-11）────────────────────────────────────────────────
// pdf.js / xlsx / mammoth 这些是 CDN 脚本，**不在 package.json 里，`npm audit`
// 从头到尾看不见它们**。它们的旧版漏洞（pdf.js CVE-2024-4367、xlsx 两个 CVE）
// 就是这么潜伏到被外部审查看出来的。更坏的是 2026-07-16 加的 SRI **锁死了版本**——
// 忠实地把一个后来被披露有漏洞的版本永远钉住，给了虚假的安全感。
//
// 数据源用 OSV.dev（Google 的开源漏洞库，免费、可脚本化）。CDN 库名映射到 npm 包名查。
//
// ── 设计红线（都对着信源体检踩过的坑）──────────────────────────────────────
// 1. **扫不到库 = 坏了，不是没漏洞。** 找到的库数为 0 或异常少 → 退 2（scan broken），
//    绝不当成"全绿"。查存在不查对应的反面。
// 2. **发现了未映射的库 = 盲区，要报。** 页面加了个新 CDN 库但没进 REGISTRY，
//    它就不会被查 CVE。这种"悄悄没覆盖到"必须响亮失败。
// 3. **OSV 查不动 = 退 2，不是绿。** 网络/接口故障时说不出"有没有漏洞"，就不能报平安。
// 4. **已登记（acknowledged）是按 CVE-id 精确豁免，不是按库。** 承认了 pdf.js 的
//    CVE-2024-4367（已运行时缓解）**不能**顺带压住 pdf.js 将来的另一个 CVE。
// 5. **每条豁免必须写理由。** 无理由的豁免就是把漏洞藏起来。

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// CDN 上出现的库名 → OSV 查询用的 npm 包名。
// ⚠️ 页面加了新 CDN 库就必须来这里加一条，否则它不会被查（见红线 2）。
export const LIB_REGISTRY = {
  'pdf.js': 'pdfjs-dist',
  xlsx: 'xlsx',
  mammoth: 'mammoth',
  marked: 'marked',
  dompurify: 'dompurify',
  docx: 'docx',
};

// 已知且已处理的 CVE，按 (npm 包, CVE-id) 精确豁免。**每条必须有 reason。**
export const ACKNOWLEDGED = [
  {
    npm: 'pdfjs-dist',
    cve: 'CVE-2024-4367',
    reason:
      '运行时缓解：analysis.html 两处 getDocument 设 isEvalSupported:false（官方缓解）。' +
      '大版本升级（3→6，ESM 重写）暂缓。若升级 pdf.js 请删掉此条。',
    added: '2026-09-11',
  },
  {
    npm: 'xlsx',
    cve: 'CVE-2023-30533',
    reason:
      'SheetJS 已离开 npm；实际加载的是 cdn.sheetjs.com 的 0.20.3 构建，含 0.19.3 的修复。' +
      'OSV 的 npm 记录无 fixed 事件，故对 xlsx 任何版本都报此 CVE——无法用 OSV 验证，只能按 SheetJS changelog 确认。',
    added: '2026-09-11',
  },
  {
    npm: 'xlsx',
    cve: 'CVE-2024-22363',
    reason:
      '同 CVE-2023-30533：修复在 SheetJS 0.20.2，cdn.sheetjs.com 的 0.20.3 构建含之；OSV npm 记录无 fixed 事件。',
    added: '2026-09-11',
  },
];

/** 解析一个 CDN 脚本 URL，取出 (cdnName, version)。认得三种格式。返回 null 表示不是已知 CDN 脚本。 */
export function parseCdnUrl(url) {
  let m;
  // cdnjs: /ajax/libs/<name>/<version>/...   （name 可含点，如 pdf.js）
  m = url.match(/cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\/([0-9][^/]*)\//);
  if (m) return { cdnName: m[1], version: m[2] };
  // jsdelivr npm: /npm/<name>@<version>/...
  m = url.match(/cdn\.jsdelivr\.net\/npm\/([^@/]+)@([0-9][^/]*)\//);
  if (m) return { cdnName: m[1], version: m[2] };
  // SheetJS: /xlsx-<version>/...
  m = url.match(/cdn\.sheetjs\.com\/xlsx-([0-9][^/]*)\//);
  if (m) return { cdnName: 'xlsx', version: m[1] };
  return null;
}

/**
 * 从若干 HTML 文本里抽出所有 CDN 库。纯函数。
 * @param {{file:string, html:string}[]} docs
 * @returns {{cdnName:string, version:string, npm:string|null, file:string}[]}
 */
export function extractCdnLibs(docs) {
  const seen = new Map(); // key: cdnName@version → entry（去重，同库在多页出现算一个）
  for (const { file, html } of docs) {
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
      const parsed = parseCdnUrl(m[1]);
      if (!parsed) continue;
      const key = `${parsed.cdnName}@${parsed.version}`;
      if (!seen.has(key)) {
        seen.set(key, {
          cdnName: parsed.cdnName,
          version: parsed.version,
          npm: LIB_REGISTRY[parsed.cdnName] ?? null, // null = 未映射 = 盲区
          file,
        });
      }
    }
  }
  return [...seen.values()];
}

/**
 * 把 OSV 结果按「未登记 / 已登记」分类。纯函数。
 * @param {{npm:string, version:string, cdnName:string, vulns:{id:string, aliases:string[]}[]}[]} results
 * @returns {{unacknowledged:object[], acknowledged:object[]}}
 */
export function classify(results) {
  const ackSet = new Set(ACKNOWLEDGED.map((a) => `${a.npm}::${a.cve}`));
  const unacknowledged = [];
  const acknowledged = [];
  for (const r of results) {
    for (const v of r.vulns) {
      // 一个漏洞可能有多个别名（GHSA + CVE），任一命中豁免即算已登记。
      const ids = [v.id, ...(v.aliases || [])];
      const ackHit = ids.some((id) => ackSet.has(`${r.npm}::${id}`));
      const row = {
        npm: r.npm,
        cdnName: r.cdnName,
        version: r.version,
        id: v.id,
        aliases: v.aliases || [],
      };
      (ackHit ? acknowledged : unacknowledged).push(row);
    }
  }
  return { unacknowledged, acknowledged };
}

// ── 以下是带 IO 的主流程，只在直接运行时执行 ──────────────────────────────

async function queryOsv(npm, version, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: { name: npm, ecosystem: 'npm' }, version }),
  });
  if (!res.ok) throw new Error(`OSV ${res.status} for ${npm}@${version}`);
  const data = await res.json();
  return data.vulns || [];
}

async function main() {
  const browserHtml = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f && !f.startsWith('tests/') && !f.startsWith('__preview'));

  const docs = browserHtml.map((f) => ({
    file: f,
    html: readFileSync(path.join(ROOT, f), 'utf8'),
  }));
  const libs = extractCdnLibs(docs);

  // 红线 1：扫不到 = 坏了。
  if (libs.length < 3) {
    console.error(`✗ 只扫到 ${libs.length} 个 CDN 库 —— 抽取多半坏了，不是"没有库"。退 2。`);
    process.exit(2);
  }
  // 红线 2：未映射的库 = 盲区。
  const unmapped = libs.filter((l) => !l.npm);
  if (unmapped.length) {
    console.error('✗ 这些 CDN 库没有 npm 映射，不会被查 CVE（盲区）——去 LIB_REGISTRY 补：');
    unmapped.forEach((l) => console.error(`    ${l.cdnName}@${l.version}  (${l.file})`));
    process.exit(2);
  }

  console.log(`扫到 ${libs.length} 个 CDN 库，逐个查 OSV：\n`);
  const results = [];
  for (const l of libs) {
    let vulns;
    try {
      vulns = await queryOsv(l.npm, l.version);
    } catch (err) {
      // 红线 3：查不动 = 退 2，不报平安。
      console.error(`✗ OSV 查询失败（${l.npm}@${l.version}）：${err.message}。退 2。`);
      process.exit(2);
    }
    results.push({ ...l, vulns });
    const tag = vulns.length ? `⚠ ${vulns.length} 个漏洞` : '✓ 干净';
    console.log(`  ${tag}  ${l.cdnName}@${l.version} (npm:${l.npm})`);
  }

  const { unacknowledged, acknowledged } = classify(results);

  if (acknowledged.length) {
    console.log(`\n已登记（已处理，见 ACKNOWLEDGED）：`);
    for (const a of acknowledged)
      console.log(`  · ${a.npm}@${a.version}  ${a.id} ${a.aliases.join(',')}`);
  }

  if (unacknowledged.length) {
    console.log(`\n🔴 未登记的漏洞（要么升级，要么在 ACKNOWLEDGED 里写明理由登记）：`);
    for (const u of unacknowledged) {
      console.log(`  ${u.cdnName}@${u.version} (npm:${u.npm})  ${u.id}  ${u.aliases.join(',')}`);
    }
    console.log(`\n共 ${unacknowledged.length} 条未处理。退 1。`);
    process.exit(1);
  }

  console.log(`\n✅ 没有未处理的 CDN 库漏洞（已登记 ${acknowledged.length} 条）。`);
}

// 直接运行才跑主流程；被 import（测试）时只导出纯函数。
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('scan-cdn-libs.mjs')
) {
  main();
}
