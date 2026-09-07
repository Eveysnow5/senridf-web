// 用**当前的 shapeOf** 重算 MANIFEST 里记录的形状 —— 不重新抓，只读仓库里存着的语料。
//
//   node scripts/corpus/reshape.js          看差异（不写）
//   node scripts/corpus/reshape.js --write   写回 MANIFEST.json
//
// 为什么要有这个：形状的**口径**改了的时候（不是信源变了），快照必须跟着换口径，
// 否则记录值和实时值算的是两件事，比对就没有意义了。
// 而重新抓会把「信源今天的内容」也一起换掉，那是另一回事 —— 两件事要分开做，
// 否则口径调整和内容更新混在一条提交里，日后谁都说不清是哪一个引起的变化。
//
// 判据：**只有 shape 变**。bytes / sha256 / fetched_at 一个都不许动 ——
// 它们描述的是存着的那份文件，那份文件这次根本没碰。
const fs = require('fs');
const path = require('path');
const { activeTargets } = require('./targets');

const ROOT = path.join(__dirname, '..', '..');
const CORPUS = path.join(ROOT, 'tests', 'corpus');
const MANIFEST = path.join(CORPUS, 'MANIFEST.json');

function main() {
  const write = process.argv.includes('--write');
  const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const all = activeTargets();
  let changed = 0;
  let missing = 0;

  for (const t of all) {
    const rec = man.snapshots[t.id];
    if (!rec) continue;
    const file = path.join(CORPUS, rec.file);
    if (!fs.existsSync(file)) {
      console.log(`  ?  ${t.id} 语料文件不在：${rec.file}`);
      missing++;
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    let live;
    try {
      live = t.shapeOf(text);
    } catch (e) {
      console.log(`  !  ${t.id} 算不出形状：${e.message}`);
      missing++;
      continue;
    }
    const before = JSON.stringify(rec.shape);
    const after = JSON.stringify(live);
    if (before === after) {
      console.log(`  =  ${t.id}`);
      continue;
    }
    changed++;
    console.log(`  ~  ${t.id}`);
    console.log(`       旧 ${before}`);
    console.log(`       新 ${after}`);
    if (write) rec.shape = live;
  }

  console.log(`\n形状有变 ${changed} 个／算不了 ${missing} 个／共 ${all.length} 个`);
  if (!write) {
    console.log('（没写。确认差异是**口径**造成的、不是信源变了，再加 --write）');
    return 0;
  }
  if (!changed) {
    console.log('没有要写的。');
    return 0;
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(man, null, 2) + '\n');
  console.log(`-> ${MANIFEST}`);
  return 0;
}

process.exit(main());
