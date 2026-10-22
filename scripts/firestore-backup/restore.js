// 从备份恢复一个 Firestore 集合（2026-10-22）。备份由 index.js 生成，存在私有仓库 senridoufuu-docs/backups/firestore/。
//
//   node restore.js <备份目录> <集合名>            —— 演练（默认）：只报告会写多少条、和线上比有什么不同，不写
//   node restore.js <备份目录> <集合名> --apply    —— 真写：按备份逐条 set（覆盖同 ID 文档；线上多出的文档不删）
//
// 需要环境变量 FIREBASE_SERVICE_ACCOUNT（服务账号 JSON），只在要真恢复时才在本机准备，用完删掉。
// 演练不连 Firestore 也能跑（不设环境变量时只核对备份文件本身）。

'use strict';

const fs = require('fs');
const path = require('path');

function decode(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(decode);
  const admin = require('firebase-admin');
  if ('__timestamp' in v) return admin.firestore.Timestamp.fromDate(new Date(v.__timestamp));
  if ('__ref' in v) return admin.firestore().doc(v.__ref);
  if ('__geo' in v) return new admin.firestore.GeoPoint(v.__geo[0], v.__geo[1]);
  const out = {};
  for (const [k, x] of Object.entries(v)) out[k] = decode(x);
  return out;
}

/** 备份文件 → [{ path, data }]（含子集合，路径形如 users/abc/lifestory/current） */
function flatten(collection, docs) {
  const rows = [];
  for (const [id, e] of Object.entries(docs)) {
    rows.push({ path: `${collection}/${id}`, data: e.data });
    for (const [sub, subDocs] of Object.entries(e.sub || {})) {
      rows.push(...flatten(`${collection}/${id}/${sub}`, subDocs));
    }
  }
  return rows;
}

async function main() {
  const [dir, collection] = process.argv.slice(2);
  const apply = process.argv.includes('--apply');
  if (!dir || !collection) throw new Error('用法：node restore.js <备份目录> <集合名> [--apply]');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const docs = JSON.parse(fs.readFileSync(path.join(dir, `${collection}.json`), 'utf8'));
  const rows = flatten(collection, docs);
  console.log(
    `备份时间 ${manifest.exportedAt}，${collection}：${Object.keys(docs).length} 条（含子集合共 ${rows.length} 个文档）`,
  );
  if (Object.keys(docs).length !== manifest.counts[collection]) {
    throw new Error(
      `备份文件条数与 manifest 不符（${manifest.counts[collection]}），文件可能损坏，停止`,
    );
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('（未设 FIREBASE_SERVICE_ACCOUNT：只核对了备份文件本身）');
    return;
  }
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  const db = admin.firestore();
  const live = await db.collection(collection).get();
  const liveIds = new Set(live.docs.map((d) => d.id));
  const backupIds = new Set(Object.keys(docs));
  console.log(
    `线上现有 ${live.size} 条；备份里有、线上没有：${[...backupIds].filter((i) => !liveIds.has(i)).length}；` +
      `线上有、备份里没有（不会删）：${[...liveIds].filter((i) => !backupIds.has(i)).length}`,
  );
  if (!apply) {
    console.log('演练结束，未写入。确认后加 --apply 真写。');
    return;
  }
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db.batch();
    for (const r of rows.slice(i, i + 400)) batch.set(db.doc(r.path), decode(r.data));
    await batch.commit();
  }
  console.log(`✓ 已写回 ${rows.length} 个文档`);
}

main().catch((e) => {
  console.error('✗', e.message || e);
  process.exit(1);
});
