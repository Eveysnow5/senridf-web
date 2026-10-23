// 受発注デモの本番スモーク（2026-10-23）。GitHub Actions から手動で走らせる。
//
// なぜ：2026-10-23、本番の AI 整形が 0.9 秒で 502 になっているのを見つけた。サイト全体の llm_usage も
// 30 日間ゼロで、いつから壊れていたか分からない。ページを開いても「整形に失敗しました」としか出ないので、
// 「AI がいま本当に動くか」を誰でも 1 クリックで確かめられるようにする。
//
// 手順は本物の訪問者と同じ：Firebase の匿名ログイン（公開 API キー）→ 本番の /api/demo-order-extract に
// サンプル注文書のテキストを POST → 状態コード・AI 側が断った理由・自動チェックの結果を表示。
// 1 回走らせるとデモの回数を 1 回消費する（Actions の IP・新しい匿名ユーザー）。AI 代は 1 円未満。
// ROUTE_ONLY=1 なら送り先の確認だけ（AI を呼ばない・回数も消費しない）。
// 出力に個人情報やキーは含まれない（公開リポジトリのログ）。

const SITE = 'https://www.senridf.com';
const FIREBASE_WEB_API_KEY = 'AIzaSyCjtAqIrGkiqDiETUqxcmkhyBVoa2IHQNM'; // js/tracking.js と同じ公開キー

// サンプル注文書（solutions/samples/sample-order.pdf）を pdf.js で読んだときの形に近いテキスト。
// 正解は docs/lead-gen/sample-order-golden.md：5 行、小計 93,840。
const SAMPLE_TEXT = [
  '注文書',
  '大阪サンプル卸株式会社 御中\t注文番号 PO-2026-1015',
  '注文日 2026年10月6日\t納期 2026年10月20日',
  '株式会社サンプル商事',
  '大阪府大阪市北区梅田1-1-1 担当：山田',
  '品番\t品名\t数量\t単位\t単価\t金額\t備考',
  'A-1001\tコピー用紙 A4 500枚\t20\t箱\t2,400\t48,000',
  'B-2050\tボールペン 黒 0.5mm\t100\t本\t120\t12,000',
  'C-3300\tクリアファイル A4 50枚入\t30\t袋\t680\t20,400',
  'D-4120\tホッチキス針 No.10\t40\t箱\t150\t6,000',
  'E-5005\tガムテープ 50mm\t24\t巻\t310\t7,440\t納期 2026/10/13',
  '小計\t93,840',
  '消費税（10%）\t9,384',
  '合計\t103,224',
].join('\n');

async function main() {
  const auth = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: `${SITE}/` },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  if (!auth.ok)
    throw new Error(`匿名ログイン失敗 HTTP ${auth.status}: ${(await auth.text()).slice(0, 200)}`);
  const { idToken } = await auth.json();
  const H = { Authorization: `Bearer ${idToken}` };

  const g = await fetch(`${SITE}/api/demo-order-extract`, { headers: H });
  const gText = await g.text();
  console.log('GET（送り先の AI）:', g.status, gText.slice(0, 120));
  // 送り先の表示名＝models.js の demoProvider().label。AI は呼ばず回数も消費しない。
  // Pages に SILICONFLOW_API_KEY が入ると「… · SiliconFlow」に変わる（2026-10-23 の段階移行の確認用）。
  let label = '';
  try {
    label = JSON.parse(gText).ai || '';
  } catch {
    /* 下で「不明」と表示 */
  }
  console.log(
    /SiliconFlow/.test(label)
      ? '→ 本番サイトの AI は硅基流动（海外站）に切り替わっている'
      : `→ 本番サイトの AI はまだ切り替わっていない（表示名：${label || '不明'}）＝Pages に SILICONFLOW_API_KEY が未設定か、設定後に再デプロイしていない`,
  );
  if (process.env.ROUTE_ONLY) return; // 送り先の確認だけ（AI を呼ばない）

  const t0 = Date.now();
  const p = await fetch(`${SITE}/api/demo-order-extract`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ name: 'sample-order.pdf', text: SAMPLE_TEXT, pageCount: 1 }],
    }),
  });
  const ms = Date.now() - t0;
  const ct = p.headers.get('content-type') || '';
  const text = await p.text();
  console.log(`POST: HTTP ${p.status}（${ms} ms, ${ct.split(';')[0]}）`);
  if (!ct.includes('json')) {
    console.log('→ JSON ではない応答＝Cloudflare 側の失敗（関数のロジックまで届いていない）');
    process.exitCode = 1;
    return;
  }
  const body = JSON.parse(text);
  if (!p.ok) {
    console.log(
      '→ エラー:',
      body.error,
      '| AI 側の状態:',
      body.upstreamStatus ?? '-',
      '|',
      body.upstreamDetail ?? '',
    );
    process.exitCode = 1;
    return;
  }
  console.log('→ 行数:', (body.rows || []).length, '| AI:', body.ai);
  const files = body.checks?.files || [];
  const bad = (body.checks?.rows || []).filter((c) => c.length).length;
  console.log('→ 自動チェック: 要確認の行', bad, '| 合計照合', JSON.stringify(files));
  // 正解：5 行・要確認 0・小計と一致
  const ok = body.rows?.length === 5 && bad === 0 && files[0]?.status === 'ok';
  console.log(ok ? '✓ 正解どおり' : '✗ 正解（5 行・要確認 0・小計一致）と違う');
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
