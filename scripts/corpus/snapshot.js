#!/usr/bin/env node
// 真实语料库：从生产信源采样，并在信源改版时报警。
//
// ── 它解决什么问题 ─────────────────────────────────────────────────────────
// 2026-08-25 引用校验误报，八种真实写法里误判五种。原因不是逻辑难，是**夹具是
// 我想象出来的**：合成样本永远比现实更短、更干净、更规整（tests/fixtures 里那几个
// 379 字节的 example.com feed 就是标本）。护栏于是只覆盖了作者当时想到的形态。
//
// 对策：把**真的东西**存进仓库，任何解析器/校验器都必须先在真语料上跑出 0 误报。
//
// ── 两个模式 ───────────────────────────────────────────────────────────────
//   node scripts/corpus/snapshot.js            体检：抓实时，与已存形状比对，报退化
//   node scripts/corpus/snapshot.js --apply    重采：抓实时，写进 tests/corpus/
//   node scripts/corpus/snapshot.js --only bids/toyonaka
//
// ⚠️ 默认是**体检**，不是重采。因为"悄悄覆盖语料"才是危险的那一侧：信源改版 →
//    语料跟着变 → 本该变红的测试对着新的坏数据继续绿。危险的一侧不能是默认。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { activeTargets, WAIVED } = require('./targets');
const { compareShape } = require('./shape');

const CORPUS_DIR = path.join(__dirname, '..', '..', 'tests', 'corpus');
const MANIFEST = path.join(CORPUS_DIR, 'MANIFEST.json');
const TIMEOUT_MS = 30000;

function parseArgs(argv) {
  const out = { apply: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') out.apply = true;
    else if (argv[i] === '--only') {
      out.only = argv[++i] || null;
      if (!out.only) return { ...out, error: '--only 后面要跟目标 id 的一部分' };
    } else if (argv[i].startsWith('--')) {
      return { ...out, error: `不认识的参数：${argv[i]}` };
    }
  }
  return out;
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return { snapshots: {} };
  }
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function fetchText(target) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.url, { headers: target.headers, signal: ctl.signal });
    const text = await res.text();
    return {
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { parseArgs, CORPUS_DIR, MANIFEST, TIMEOUT_MS };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    console.error('用法：node scripts/corpus/snapshot.js [--apply] [--only <id 片段>]');
    process.exit(1);
  }

  const manifest = readManifest();
  let targets = activeTargets();
  if (args.only) targets = targets.filter((t) => t.id.includes(args.only));
  if (!targets.length) {
    console.error(`没有目标匹配 --only ${args.only}`);
    process.exit(1);
  }

  console.log(args.apply ? '模式：**重采并写入语料库**' : '模式：体检（不写文件）');
  console.log(`目标 ${targets.length} 个\n`);

  let ok = 0;
  let drifted = 0;
  let failed = 0;
  const next = { ...manifest.snapshots };

  for (const t of targets) {
    const recorded = manifest.snapshots[t.id];
    let got;
    try {
      got = await fetchText(t);
    } catch (err) {
      console.log(`✗ ${t.id}  抓取失败：${err.message}`);
      failed++;
      continue;
    }
    if (got.status !== 200) {
      console.log(`✗ ${t.id}  HTTP ${got.status}（信源可能改地址或下线了）`);
      failed++;
      continue;
    }

    let shape;
    try {
      shape = t.shapeOf(got.text);
    } catch (err) {
      console.log(`✗ ${t.id}  抓到了但解析抛错：${err.message}`);
      failed++;
      continue;
    }

    const regressions = compareShape(recorded && recorded.shape, shape);
    const summary = Object.entries(shape)
      .filter(([k]) => k !== 'kind')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');

    if (regressions.length) {
      console.log(`⚠ ${t.id}  ${summary}`);
      regressions.forEach((r) => console.log(`    退化：${r}`));
      drifted++;
    } else {
      console.log(`✓ ${t.id}  ${summary}${recorded ? '' : '（新目标，无历史可比）'}`);
      ok++;
    }

    if (args.apply) {
      const dest = path.join(CORPUS_DIR, t.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, got.text, 'utf8');
      next[t.id] = {
        url: t.url,
        label: t.label,
        file: t.file,
        fetched_at: new Date().toISOString(),
        http_status: got.status,
        content_type: got.contentType,
        bytes: Buffer.byteLength(got.text, 'utf8'),
        sha256: sha256(got.text),
        shape,
      };
    }
  }

  if (args.apply) {
    fs.mkdirSync(CORPUS_DIR, { recursive: true });
    fs.writeFileSync(
      MANIFEST,
      JSON.stringify(
        {
          note:
            '真实信源快照的出处记录。sha256 用于溯源（这份语料是哪一版），不用于告警 —— ' +
            '新闻 feed 每小时都在变，字节比对天天报警等于没有报警。告警看 shape。',
          waived: WAIVED,
          snapshots: next,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    console.log(`\n已写入 ${path.relative(process.cwd(), MANIFEST)}`);
  }

  console.log(`\n完成：正常 ${ok}，退化 ${drifted}，失败 ${failed}`);
  for (const [id, why] of Object.entries(WAIVED)) {
    console.log(`（跳过 ${id}：${why.split('。')[0]}。）`);
  }
  if (!args.apply && (drifted || failed)) {
    console.log('\n确认信源确实改版、且解析器已跟上之后，用 --apply 重采语料。');
    process.exit(1);
  }
}
