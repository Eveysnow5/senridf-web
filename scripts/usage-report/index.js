// 读 Firestore llm_usage/{YYYY-MM-DD}，按天、按端点打印调用次数与 token（2026-10-20）。
// 用途：估算换成付费模型后每天要花多少钱。后台 admin.html 也能看，但只有管理员登录后才看得到；
// 这里用仓库已有的服务账号，在 Actions 里手动触发即可（.github/workflows/usage-report.yml）。
// 输出只有数字（无个人信息），公开仓库的日志里可以出现。
//
// ⚠️ 流式端点（translate-stream 实时口译、analyze-stream）只记调用次数、不记 token
//    （见 functions/api/_lib/usageRecorder.js 文件头），所以它们的 token 列是 0 ≠ 没花钱。

'use strict';

const DAYS = Number(process.env.DAYS || 60);

async function main() {
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  const snap = await admin.firestore().collection('llm_usage').get();
  const since = new Date(Date.now() - DAYS * 86400 * 1000).toISOString().slice(0, 10);
  const rows = snap.docs.filter((d) => d.id >= since).sort((a, b) => (a.id < b.id ? -1 : 1));
  const n = (v) => (Number.isFinite(v) ? v : 0);

  console.log(`最近 ${DAYS} 天，有记录的天数：${rows.length}`);
  console.log('日期 | 调用 | 输入 | 输出 | 推理 | 无usage | 按端点（调用/总token）');
  const tot = { calls: 0, prompt: 0, completion: 0, reasoning: 0, missing: 0 };
  const byTask = {};
  for (const doc of rows) {
    const d = doc.data();
    tot.calls += n(d.calls);
    tot.prompt += n(d.prompt_tokens);
    tot.completion += n(d.completion_tokens);
    tot.reasoning += n(d.reasoning_tokens);
    tot.missing += n(d.missing_usage);
    const parts = [];
    for (const [t, v] of Object.entries(d.by_task || {})) {
      const a = (byTask[t] = byTask[t] || { calls: 0, total: 0, missing: 0, days: 0 });
      a.calls += n(v.calls);
      a.total += n(v.total_tokens);
      a.missing += n(v.missing_usage);
      a.days += 1;
      parts.push(`${t} ${n(v.calls)}/${n(v.total_tokens)}`);
    }
    console.log(
      [
        doc.id,
        n(d.calls),
        n(d.prompt_tokens),
        n(d.completion_tokens),
        n(d.reasoning_tokens),
        n(d.missing_usage),
        parts.join(', '),
      ].join(' | '),
    );
  }
  console.log('\n合计', JSON.stringify(tot));
  console.log('按端点合计', JSON.stringify(byTask, null, 1));

  // ── 线上 CSP 违规（js/shared/report-error.js 上报到 errors 集合）──
  // 转强制拦截前看这里：Report-Only 期间真实用户遇到的违规都在。只打印指令、被拦地址（去掉
  // 查询串）、页面路径、次数、最后时间——不打印邮箱 / UA / 报错原文（公开仓库的日志）。
  const errs = await admin.firestore().collection('errors').get();
  const csp = [];
  const jsByPage = {};
  for (const d of errs.docs) {
    const e = d.data();
    const last =
      e.lastSeen && e.lastSeen.toDate ? e.lastSeen.toDate().toISOString().slice(0, 10) : '?';
    if (e.type === 'csp') {
      csp.push(
        [
          last,
          n(e.count),
          e.violatedDirective,
          String(e.blockedURI || '').split('?')[0],
          e.lastPage,
          e.disposition,
        ].join(' | '),
      );
    } else {
      const k = `${e.type} ${e.lastPage}`;
      jsByPage[k] = (jsByPage[k] || 0) + n(e.count);
    }
  }
  console.log(`\nCSP 违规（${csp.length} 种）：最后出现 | 次数 | 指令 | 被拦地址 | 页面 | 处置`);
  for (const line of csp.sort().reverse()) console.log(line);
  console.log('\n其它前端错误次数（按类型+页面，不含原文）', JSON.stringify(jsByPage, null, 1));
  // ── 访客（visits 集合，js/shared/track-visit.js 写入）2026-10-22 ──
  // 回答「零咨询是没人来还是来了没人填」。一条记录＝某身份某天看了某类页面（同日同页去重）。
  // 只打印计数，不打印邮箱 / anonId（公开仓库的日志）。登录过的身份（有 email）多半是我们自己，单独计数。
  const vs = await admin.firestore().collection('visits').get();
  const vRows = vs.docs
    .map((d) => d.data())
    .filter((v) => v.timestamp && v.timestamp.toDate)
    .map((v) => ({ ...v, day: v.timestamp.toDate().toISOString().slice(0, 10) }))
    .filter((v) => v.day >= since);
  const internal = vRows.filter((v) => v.email);
  const ext = vRows.filter((v) => !v.email);
  const who = (v) => v.anonId || 'unknown';
  const people = new Map();
  for (const v of ext) {
    const p = people.get(who(v)) || { days: new Set(), pages: new Set() };
    p.days.add(v.day);
    p.pages.add(v.page);
    people.set(who(v), p);
  }
  console.log(
    `\n访客（最近 ${DAYS} 天）：记录 ${vRows.length}（其中登录身份 ${internal.length} 条另计）；` +
      `匿名访客 ${people.size} 人，来过 ≥2 天的 ${[...people.values()].filter((p) => p.days.size >= 2).length} 人`,
  );
  const byWeek = {};
  for (const v of ext) {
    const d = new Date(v.day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const wk = d.toISOString().slice(0, 10);
    (byWeek[wk] = byWeek[wk] || new Set()).add(who(v));
  }
  console.log(
    '按周（周一起）匿名访客数',
    JSON.stringify(
      Object.fromEntries(
        Object.entries(byWeek)
          .sort()
          .map(([k, s]) => [k, s.size]),
      ),
    ),
  );
  const byPage = {};
  for (const v of ext) {
    const a = (byPage[v.page] = byPage[v.page] || { people: new Set(), mobile: 0, durs: [] });
    a.people.add(who(v));
    if (v.device === 'mobile') a.mobile++;
    if (Number.isFinite(v.duration)) a.durs.push(v.duration);
  }
  console.log('页面 | 匿名访客 | 手机占比 | 停留中位数秒 | 停留<10秒占比');
  for (const [pg, a] of Object.entries(byPage).sort(
    (x, y) => y[1].people.size - x[1].people.size,
  )) {
    const ds = a.durs.sort((x, y) => x - y);
    const med = ds.length ? ds[Math.floor(ds.length / 2)] : '-';
    const short = ds.length
      ? Math.round((100 * ds.filter((x) => x < 10).length) / ds.length) + '%'
      : '-';
    const rows = ext.filter((v) => v.page === pg).length;
    console.log(
      [pg, a.people.size, Math.round((100 * a.mobile) / rows) + '%', med, short].join(' | '),
    );
  }
  // 来源（2026-10-22 起才记录 refSource，之前的记录都算「直接/未知」）
  const bySrc = {};
  for (const v of ext) {
    const k = v.refSource || '(直接/未知)';
    const a = (bySrc[k] = bySrc[k] || { people: new Set(), pages: {} });
    a.people.add(who(v));
    a.pages[v.page] = (a.pages[v.page] || 0) + 1;
  }
  console.log('来源 | 匿名访客 | 落在哪些页面');
  for (const [k, a] of Object.entries(bySrc).sort((x, y) => y[1].people.size - x[1].people.size)) {
    console.log([k, a.people.size, JSON.stringify(a.pages)].join(' | '));
  }
  const depth = {};
  for (const p of people.values()) depth[p.pages.size] = (depth[p.pages.size] || 0) + 1;
  console.log('每人看过几类页面 → 人数', JSON.stringify(depth));
  console.log(
    '看过受発注 LP 的人里也看过 contact 的',
    [...people.values()].filter((p) => p.pages.has('order-to-ledger') && p.pages.has('contact'))
      .length,
    '/',
    [...people.values()].filter((p) => p.pages.has('order-to-ledger')).length,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
