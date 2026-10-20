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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
