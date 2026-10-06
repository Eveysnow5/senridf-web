// 相談リードの到着通知（GitHub Actions・毎時）。
//
// なぜ要るか（2026-10-06）：受発注 LP に「1営業日以内にご返信します」と書いた。だが相談は
// Firestore の leads に入るだけで、管理画面を開かない限り誰も気づかない。約束を守れるかが
// 「毎日管理画面を開くのを覚えているか」に懸かるのは、いずれ必ず漏れる。
//
// 仕組み：未通知（notifiedAt なし）の leads を数え、1 件以上なら GitHub issue を立てる
// （作者に @mention → GitHub がメールを送る）。issue 作成に**成功してから** notifiedAt を付ける：
//   逆順だと「印は付いたが通知は出ていない」で永久に取りこぼす。この順なら最悪でも重複通知。
//
// ⚠️ このリポジトリは公開。issue 本文に**個人情報（氏名・メール・相談内容・会社名）を一切
//    載せない**。件数と管理画面へのリンクだけ。buildIssue のテストがこれを固定している。
//
// 重い依存（firebase-admin）は main() の中で require する：仓库根の node --test が
// この純関数だけを読み込めるように（scripts/bid-scraper/backfill.js と同じ流儀）。

const ADMIN_URL = 'https://www.senridf.com/solutions/demo/admin.html';
const MENTION = '@sherlockafa007';

/** 未通知のリードだけを選ぶ（notifiedAt が無いもの）。 */
function pickUnnotified(docs) {
  return docs.filter((d) => d && !d.notifiedAt);
}

/** issue のタイトルと本文。**個人情報は入れない**（件数・受信時刻・リンクのみ）。 */
function buildIssue(leads, now = new Date()) {
  const jst = (d) =>
    new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const times = leads
    .map((l) => (l.createdAt instanceof Date ? l.createdAt : null))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const oldest = times[0];
  const lines = [
    `${MENTION} 新しい相談が **${leads.length} 件** 届いています。`,
    '',
    oldest ? `- 最も古い受信：${jst(oldest)}（JST）` : null,
    `- 返信の約束：**1営業日以内**（受発注ページに掲載）`,
    `- 内容の確認・返信：[管理画面](${ADMIN_URL}) の「相談リード」`,
    '',
    '> 公開リポジトリのため、氏名・メールアドレス・相談内容はここには載せていません。',
    '> 返信が済んだらこの issue を閉じてください。',
  ].filter((x) => x !== null);
  return {
    title: `新しい相談 ${leads.length} 件（${jst(now)} JST）`,
    body: lines.join('\n'),
  };
}

async function createIssue({ title, body }) {
  const repo = process.env.GITHUB_REPOSITORY;
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) throw new Error(`issue 作成失敗 HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).html_url;
}

async function main() {
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
  const db = admin.firestore();
  // リードは少量（管理画面も 200 件まで）。notifiedAt の欠落はクエリできないので、
  // 新しい順に取ってコード側で選ぶ。
  const snap = await db.collection('leads').orderBy('createdAt', 'desc').limit(200).get();
  const docs = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      notifiedAt: v.notifiedAt || null,
      createdAt: v.createdAt && v.createdAt.toDate ? v.createdAt.toDate() : null,
    };
  });
  const fresh = pickUnnotified(docs);
  console.log(`leads: ${docs.length} 件中 未通知 ${fresh.length} 件`);
  if (!fresh.length) return;

  const url = await createIssue(buildIssue(fresh));
  console.log('通知 issue:', url);
  const batch = db.batch();
  for (const l of fresh) {
    batch.update(db.collection('leads').doc(l.id), {
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`notifiedAt を ${fresh.length} 件に記録`);
}

module.exports = { pickUnnotified, buildIssue, ADMIN_URL };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
