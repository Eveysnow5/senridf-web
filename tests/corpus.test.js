const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { activeTargets, WAIVED } = require('../scripts/corpus/targets');
const { compareShape, METI_PRESS_PATH } = require('../scripts/corpus/shape');

// 真实语料回归网。
//
// 为什么需要它：2026-08-26 之前，tests/fixtures 里的 feed 夹具是 379 字节的
// example.com 合成样本。565 个测试全绿的同时，**PR TIMES 200 条的发布日期全是
// null** —— 它发的是 RDF（<dc:date>），而解析器只认 RSS 2.0 的 <pubDate>。
// 合成夹具恰好写成了 RSS 2.0，于是这个洞谁也没碰到。
//
// 这里跑的是**离线**的：语料文件已经提交进仓库，测试不联网。联网体检是
// scripts/corpus/snapshot.js 的事（默认不写文件，见那里的说明）。

const CORPUS = path.join(__dirname, 'corpus');
const manifest = JSON.parse(fs.readFileSync(path.join(CORPUS, 'MANIFEST.json'), 'utf8'));

function readCorpus(file) {
  return fs.readFileSync(path.join(CORPUS, file), 'utf8');
}

// ── 覆盖度：线上抓的每个源，语料库里都得有 ────────────────────────────────
// 这条是防"语料库烂掉"的：有人往 sources.js 加了个源，却没采语料，
// 于是那个源的解析从此无人把关。要跳过必须在 WAIVED 里写理由。
test('★ 每个在采的信源都有语料快照', () => {
  const missing = [];
  for (const t of activeTargets()) {
    if (!fs.existsSync(path.join(CORPUS, t.file))) missing.push(`${t.id}（缺文件 ${t.file}）`);
    else if (!manifest.snapshots[t.id]) missing.push(`${t.id}（缺 MANIFEST 记录）`);
  }
  assert.deepEqual(
    missing,
    [],
    `这些信源没有语料，解析改坏了不会有人发现：\n${missing.join('\n')}\n` +
      `补采：node scripts/corpus/snapshot.js --apply`,
  );
});

test('WAIVED 里的每一条都要写明理由', () => {
  for (const [id, why] of Object.entries(WAIVED)) {
    assert.ok(why && why.length > 20, `${id} 的豁免理由太简短，说不清为什么不采`);
    assert.match(why, /\d{4}-\d{2}-\d{2}/, `${id} 的豁免理由里没有日期，日后无法判断该不该复活`);
  }
});

// ── 形状没退化 ─────────────────────────────────────────────────────────────
// 从**提交的语料文件**重新算形状，跟**提交的 MANIFEST**比。
// 改坏解析器 → 重算的形状掉下来 → 这里变红。
// （重新采集会同时更新两边，那是有意重新定基线，diff 在 git 里看得见。）
test('★ 解析器跑提交的语料，形状不能比 MANIFEST 记录的差', () => {
  const bad = [];
  for (const t of activeTargets()) {
    const recorded = manifest.snapshots[t.id];
    if (!recorded) continue; // 上一条测试负责报这个
    const live = t.shapeOf(readCorpus(t.file));
    const regressions = compareShape(recorded.shape, live);
    if (regressions.length) bad.push(`${t.id}: ${regressions.join('; ')}`);
  }
  assert.deepEqual(bad, [], `解析结果退化：\n${bad.join('\n')}`);
});

// 上面那条测试完全依赖 compareShape。突变验证里把 compareShape 改成永远返回空数组，
// 它照样全绿 —— 护栏瞎了，而依赖它的测试无法察觉。所以先验一下护栏自己还看得见。
test('护栏自身有效：compareShape 认得出退化', () => {
  const before = { kind: 'feed', items: 100, pct_title: 100, pct_date: 100 };
  assert.deepEqual(compareShape(before, before), [], '没变化时不该报警');
  assert.ok(compareShape(before, { ...before, items: 0 }).length, '一条都解析不出来居然不报警');
  assert.ok(compareShape(before, { ...before, items: 10 }).length, '条目数掉了 90% 居然不报警');
  assert.ok(
    compareShape(before, { ...before, pct_date: 0 }).length,
    '日期覆盖率从 100% 掉到 0 居然不报警 —— 这正是 PR TIMES 那个洞的形状',
  );
  assert.deepEqual(
    compareShape(before, { ...before, items: 500, pct_date: 100 }),
    [],
    '条目变多不该报警，否则信源多发几条就会误报，护栏很快就没人看了',
  );
});

// ── 硬底线 ─────────────────────────────────────────────────────────────────
// 上面那条比的是"跟上次相比"，如果基线本身就是坏的（比如 PR TIMES 曾经
// pct_date=0），它照样全绿。所以再压一层**不依赖 MANIFEST** 的绝对要求。
const FLOORS = {
  'ai-intel/robotstart': { items: 20, pct_title: 100, pct_url: 100, pct_date: 90 },
  'ai-intel/prtimes': { items: 50, pct_title: 100, pct_url: 100, pct_date: 90 },
  'ai-intel/itmedia': { items: 10, pct_title: 100, pct_url: 100, pct_date: 90 },
  'ai-intel/meti': { items: 10, pct_title: 100, pct_url: 100, pct_article: 50 },
  'bids/osaka-gyomuitaku': { items: 5, pct_title: 100, pct_url: 100 },
  'bids/osaka-buppin': { items: 1, pct_title: 100, pct_url: 100 },
  'bids/suita-gyomuitaku': { items: 1, pct_title: 100, pct_url: 100 },
  'bids/suita-buppin': { items: 1, pct_title: 100, pct_url: 100 },
  'bids/toyonaka': { items: 1, pct_title: 100, pct_url: 100 },
};

test('★ 硬底线：真实语料上必须达到的解析质量', () => {
  const targets = activeTargets();
  assert.ok(targets.length >= 9, '目标数少于 9，说明信源配置被削掉了');

  const bad = [];
  for (const t of targets) {
    const floor = FLOORS[t.id];
    assert.ok(floor, `${t.id} 没定硬底线 —— 新增信源要在 FLOORS 里补一条`);
    const shape = t.shapeOf(readCorpus(t.file));
    for (const [k, min] of Object.entries(floor)) {
      if (shape[k] < min) bad.push(`${t.id}.${k} = ${shape[k]}，低于底线 ${min}`);
    }
  }
  assert.deepEqual(bad, [], `真实语料上的解析质量不达标：\n${bad.join('\n')}`);
});

// PR TIMES 那个洞值得单独钉一根钉子：它是**这套语料库找出来的第一个真 bug**，
// 也是"合成夹具恰好避开了真实格式"的标本。断言写在具体格式上，而不是比例上。
test('★ RDF feed（PR TIMES）的 dc:date 必须解析得出来', () => {
  const { parseFeed } = require('../scripts/ai-intel-scraper/parse');
  const xml = readCorpus('ai-intel/prtimes.xml');
  assert.match(xml, /<rdf:RDF/, '语料已经不是 RDF 了，这条钉子要重新钉');
  assert.ok(!/<pubDate/.test(xml), 'PR TIMES 开始发 pubDate 了，那这条测的就不是原来那件事');

  const items = parseFeed(xml);
  assert.ok(items.length >= 50, `只解析出 ${items.length} 条`);
  const dated = items.filter((i) => i.published_at);
  assert.equal(dated.length, items.length, `${items.length - dated.length} 条没有发布日期`);

  // 只断言"有日期"抓不住退化：PR TIMES 除了 <dc:date> 还发一个私有的
  // <date>2026-08-26</date>（只到天）。突变验证里把 dc:date 删掉，测试照样绿 ——
  // 因为兜底的 <date> 顶上了，代价是**时分秒全丢**，而这是看不见的降级。
  // 所以这里跟原文里的 dc:date 逐字对齐，退到 <date> 就会变成 00:00:00 而对不上。
  // 必须先切出第一个 <item>：<channel> 自己也有个 <dc:date>（feed 的构建时间），
  // 直接全文匹配会取到它，跟条目的时间对不上。
  const firstItem = xml.match(/<item[\s\S]*?<\/item>/);
  assert.ok(firstItem, '语料里找不到 <item>');
  const raw = firstItem[0].match(/<dc:date>([^<]+)<\/dc:date>/);
  assert.ok(raw, '第一条 item 里已经没有 dc:date 了，这条钉子要重新钉');
  assert.equal(
    items[0].published_at,
    new Date(raw[1]).toISOString(),
    '第一条的时间和原文 dc:date 对不上 —— 多半是退回到只精确到天的 <date> 兜底了',
  );
});

// pct_article 只有下限（≥50），于是**把判据放宽**是隐形的：突变验证里把
// METI_PRESS_PATH 改成 /.*/，比例从 74% 涨到 100%，下限和 compareShape 都不会响
// —— 后者只管跌不管涨。判据必须两头都验：该收的收得住，该拒的还拒得掉。
test('★ METI 正文判据两头都要成立', () => {
  const ARTICLES = [
    'https://www.meti.go.jp/press/2026/08/20260826001.html',
    'https://www.meti.go.jp/press/2026/12/20261201009.html',
  ];
  const JUNK = [
    'https://www.meti.go.jp/english/press/index.html',
    'https://www.meti.go.jp/press/category_03.html',
    'https://www.meti.go.jp/press/archive.html',
    'http://warp.da.ndl.go.jp/waid/3479',
    'https://www.meti.go.jp/press/2026/08/',
  ];
  for (const u of ARTICLES) assert.ok(METI_PRESS_PATH.test(u), `真新闻稿被拒了：${u}`);
  for (const u of JUNK) assert.ok(!METI_PRESS_PATH.test(u), `导航/外站被当成新闻稿：${u}`);

  // 而且真实语料上必须**还在拒东西**。METI 首页确实混着导航链接，
  // 如果比例变成 100%，说明判据已经不判了。
  const { parseListLinks } = require('../scripts/ai-intel-scraper/parse');
  const links = parseListLinks(readCorpus('ai-intel/meti.html'), {
    linkSelector: '#maincontents a, #main a, .press a',
    base: 'https://www.meti.go.jp/press/',
  });
  const hit = links.filter((l) => METI_PRESS_PATH.test(l.url)).length;
  assert.ok(hit > 0, '真实语料上一条新闻稿都没认出来');
  assert.ok(hit < links.length, `${links.length} 条全被认成新闻稿 —— 判据已经不判了`);
});

// ── 出处记录 ───────────────────────────────────────────────────────────────
// 没有采集时间的语料是个陷阱：信源三个月前改过版，而语料还是老的，
// 测试对着过时的现实全绿。
test('MANIFEST 每条都有出处：URL、采集时间、状态码、字节数', () => {
  const entries = Object.entries(manifest.snapshots);
  assert.ok(entries.length >= 9, `MANIFEST 只有 ${entries.length} 条`);
  for (const [id, m] of entries) {
    assert.match(m.url, /^https:\/\//, `${id} 没有来源 URL`);
    assert.match(m.fetched_at, /^\d{4}-\d{2}-\d{2}T/, `${id} 没有采集时间`);
    assert.equal(m.http_status, 200, `${id} 存的是非 200 的响应`);
    assert.ok(m.bytes > 1000, `${id} 只有 ${m.bytes} 字节 —— 存的多半是错误页而不是真内容`);
    assert.match(m.sha256, /^[0-9a-f]{64}$/, `${id} 没有内容指纹`);

    // 只验指纹**格式**等于没验。指纹要真的对得上，否则它证明不了任何事。
    // 这条同时钉住 .gitattributes 里的 `tests/corpus/** -text`：
    // 少了那一行，Windows 上检出会把 LF 换成 CRLF，字节数和 sha256 立刻全对不上。
    const raw = fs.readFileSync(path.join(CORPUS, m.file));
    assert.equal(
      crypto.createHash('sha256').update(raw).digest('hex'),
      m.sha256,
      `${id} 的内容和 MANIFEST 记的指纹对不上 —— 文件被改过，或者换行被 git 转换了` +
        `（检查 .gitattributes 里的 tests/corpus/** -text）`,
    );
    assert.equal(raw.length, m.bytes, `${id} 的字节数和 MANIFEST 记的对不上`);
    assert.ok(m.bytes > 1000, `${id} 只有 ${m.bytes} 字节`);
  }
});

// 语料必须比原来的合成夹具**大得多**。这条是这整件事的立意：
// 合成夹具永远比现实更短、更干净、更规整，而 bug 就藏在现实的脏东西里。
test('语料是真东西：没有 example.com 这类合成痕迹', () => {
  for (const t of activeTargets()) {
    const text = readCorpus(t.file);
    assert.ok(
      !text.includes('example.com'),
      `${t.id} 里有 example.com —— 这是合成夹具的味道，不该出现在真实语料里`,
    );
    assert.ok(text.length > 5000, `${t.id} 只有 ${text.length} 字符，不像真实页面`);
  }
});
