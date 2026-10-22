// Firestore 每周备份（2026-10-22）：把业务数据导出成 JSON，推进**私有**仓库 senridoufuu-docs 的 backups/firestore/。
// 由 .github/workflows/firestore-backup.yml 运行。
//
// 为什么：咨询线索（leads）、会员名单（users，含日程・人生故事存档）、博客草稿等只存在 Firestore 里，
// 之前没有任何备份——误删或规则写错就找不回来。
//
// ⚠️ 本仓库是公开的，Actions 日志任何人可见：这里**只打印集合名和条数**，不打印任何内容。
//    数据只写到 runner 磁盘上的 docs 仓库副本里，由 workflow 推进私有仓库。
//
// 用法：node index.js <输出目录>
//   输出：<目录>/<集合>.json（每个集合一个文件，键排序以便看 diff）＋ manifest.json（条数・时间）
//
// 护栏（备份坏了不能悄悄地「成功」）：
//   ① 必备集合（REQUIRED）必须读到且非空，否则退出 1，不写任何文件；
//   ② 和上一次 manifest 比，任何集合条数掉了一半以上 → 退出 1、**不覆盖旧备份**（可能是误删，旧备份就是救命的那份）。
//      确属正常（如手动清理），用 ALLOW_SHRINK=集合名,... 放行一次。

'use strict';

const fs = require('fs');
const path = require('path');

// 不备份的：访问统计・错误日志（量大、可再生、有 TTL）、限流与配额计数（临时状态）。
const EXCLUDE = new Set([
  'visits',
  'errors',
  'rate_limits',
  'demo_quota',
  'demo_quota_ip',
  'demo_quota_day',
]);
// 有子集合的父集合（firestore.rules 里嵌套的 match 只在 users 下）。逐文档列子集合很慢，所以只查这些。
const WITH_SUBCOLLECTIONS = new Set(['users']);
const REQUIRED = ['users'];

function encode(v) {
  if (v === null || typeof v !== 'object') return v;
  if (typeof v.toDate === 'function' && typeof v.seconds === 'number') {
    return { __timestamp: v.toDate().toISOString() };
  }
  if (typeof v.path === 'string' && typeof v.firestore === 'object') return { __ref: v.path };
  if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
    return { __geo: [v.latitude, v.longitude] };
  }
  if (Array.isArray(v)) return v.map(encode);
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = encode(v[k]);
  return out;
}

async function dumpCollection(col, withSubs) {
  const snap = await col.get();
  const docs = {};
  for (const d of snap.docs) {
    const entry = { data: encode(d.data()) };
    if (withSubs) {
      const subs = await d.ref.listCollections();
      if (subs.length) {
        entry.sub = {};
        for (const s of subs.sort((a, b) => (a.id < b.id ? -1 : 1))) {
          entry.sub[s.id] = (await dumpCollection(s, false)).docs;
        }
      }
    }
    docs[d.id] = entry;
  }
  const sorted = {};
  for (const k of Object.keys(docs).sort()) sorted[k] = docs[k];
  return { count: snap.size, docs: sorted };
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('用法：node index.js <输出目录>');
  const admin = require('firebase-admin');
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  const cols = (await db.listCollections()).map((c) => c.id).sort();
  const result = {};
  for (const id of cols) {
    if (EXCLUDE.has(id)) continue;
    result[id] = await dumpCollection(db.collection(id), WITH_SUBCOLLECTIONS.has(id));
  }

  const counts = Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.count]));
  console.log('读到的集合与条数：', JSON.stringify(counts));
  console.log('跳过（不备份）：', cols.filter((c) => EXCLUDE.has(c)).join(', ') || '无');

  // ① 必备集合
  const missing = REQUIRED.filter((c) => !counts[c]);
  if (missing.length) {
    console.error(
      `✗ 必备集合读不到或为空：${missing.join(', ')}。不写备份（多半是权限或连接问题）。`,
    );
    process.exit(1);
  }

  // ② 与上次比，条数骤减就停
  const manifestPath = path.join(outDir, 'manifest.json');
  const allow = new Set((process.env.ALLOW_SHRINK || '').split(',').filter(Boolean));
  if (fs.existsSync(manifestPath)) {
    const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).counts || {};
    const shrunk = Object.entries(prev).filter(
      ([c, n]) => n >= 4 && (counts[c] || 0) < n / 2 && !allow.has(c),
    );
    if (shrunk.length) {
      console.error(
        '✗ 这些集合条数比上次备份少了一半以上，可能是误删——**没有覆盖旧备份**：\n' +
          shrunk.map(([c, n]) => `  ${c}: ${n} → ${counts[c] || 0}`).join('\n') +
          '\n确认是正常清理的话，手动运行 workflow 并填 allow_shrink。',
      );
      process.exit(1);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  // 上次有、这次没有的集合文件删掉（集合整个没了也会被上面的骤减检查拦下）
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.json') && f !== 'manifest.json' && !(f.slice(0, -5) in result)) {
      fs.unlinkSync(path.join(outDir, f));
    }
  }
  for (const [id, v] of Object.entries(result)) {
    fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(v.docs, null, 1) + '\n');
  }
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      { exportedAt: new Date().toISOString(), project: sa.project_id, counts },
      null,
      1,
    ) + '\n',
  );

  // 写完读回来核对条数（写坏了要在这里发现，而不是等到要恢复的那天）
  for (const [id, n] of Object.entries(counts)) {
    const back = Object.keys(
      JSON.parse(fs.readFileSync(path.join(outDir, `${id}.json`), 'utf8')),
    ).length;
    if (back !== n) {
      console.error(`✗ ${id}.json 读回 ${back} 条，应为 ${n}`);
      process.exit(1);
    }
  }
  console.log(`✓ 已写 ${Object.keys(result).length} 个集合，读回核对一致`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
