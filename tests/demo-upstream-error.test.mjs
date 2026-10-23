import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/demo-order-extract.js';

// 端点を丸ごと通す（fetch だけ差し替え）：
//   ・AI 側が断ったとき、理由が 424 の JSON で返る（以前は 502 → 本番では Cloudflare の HTML に化けて理由が消えた）
//   ・成功時は自動チェックの結果（checks）が付く
// 期待値は手書き。サンプル注文書の値は docs/lead-gen/sample-order-golden.md から。

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(ai) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(':commit')) {
      const writeResults = [0, 1, 2].map(() => ({ transformResults: [{ integerValue: '1' }] }));
      return new Response(JSON.stringify({ writeResults }), { status: 200 });
    }
    if (u.includes('chat/completions')) return ai();
    return new Response('{}', { status: 200 });
  };
}

const ctx = () => ({
  request: new Request('https://www.senridf.com/api/demo-order-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify({ items: [{ name: 'sample-order.pdf', text: '注文書 …', pageCount: 1 }] }),
  }),
  env: { QWEN_API_KEY: 'x' },
  data: { user: { uid: 'u1', provider: 'anonymous' }, idToken: 't' },
  waitUntil: () => {},
});

test('AI 側が 403（無料枠切れ）→ 424・ai_upstream・相手の状態コードと理由の先頭', async () => {
  mockFetch(
    () =>
      new Response('{"error":{"message":"Free quota exhausted. To continue ..."}}', {
        status: 403,
      }),
  );
  const res = await onRequest(ctx());
  assert.equal(res.status, 424);
  assert.match(res.headers.get('Content-Type'), /application\/json/);
  const body = await res.json();
  assert.equal(body.error, 'ai_upstream');
  assert.equal(body.upstreamStatus, 403);
  assert.match(body.upstreamDetail, /Free quota exhausted/);
  assert.ok(body.upstreamDetail.length <= 160);
});

test('AI 側に繋がらない（例外）→ 424・状態コードは null・理由はエラー文', async () => {
  mockFetch(() => {
    throw new TypeError('network down');
  });
  const res = await onRequest(ctx());
  assert.equal(res.status, 424);
  const body = await res.json();
  assert.equal(body.upstreamStatus, null);
  assert.match(body.upstreamDetail, /network down/);
});

test('成功：行と自動チェック（小計と一致）が返る', async () => {
  const rows = [
    ['A-1001', 'コピー用紙 A4 500枚', '20', '箱', '2,400', '48,000'],
    ['B-2050', 'ボールペン 黒 0.5mm', '100', '本', '120', '12,000'],
    ['C-3300', 'クリアファイル A4 50枚入', '30', '袋', '680', '20,400'],
    ['D-4120', 'ホッチキス針 No.10', '40', '箱', '150', '6,000'],
    ['E-5005', 'ガムテープ 50mm', '24', '巻', '310', '7,440'],
  ].map(([品番, 品名, 数量, 単位, 単価, 金額]) => ({ 品番, 品名, 数量, 単位, 単価, 金額 }));
  const content = JSON.stringify({
    rows,
    totals: { 小計: '93,840', 消費税: '9,384', 合計: '103,224' },
  });
  mockFetch(
    () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200,
      }),
  );
  const res = await onRequest(ctx());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rows.length, 5);
  assert.deepEqual(body.checks.rows, [[], [], [], [], []]);
  assert.deepEqual(body.checks.files, [
    { file: 'sample-order.pdf', status: 'ok', basis: 'subtotal', sum: 93840, printed: 93840 },
  ]);
});
