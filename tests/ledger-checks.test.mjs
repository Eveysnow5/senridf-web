import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNum,
  parseDate,
  checkRow,
  checkTotals,
  checkLedger,
} from '../functions/api/_lib/ledgerChecks.js';
import { parseTotals } from '../functions/api/demo-order-extract.js';
import { buildDemoOrderPrompt } from '../functions/api/_lib/buildDemoOrderPrompt.js';

// 期待値は手書き。サンプル注文書の値は docs/lead-gen/sample-order-golden.md（印字：小計 93,840 /
// 消費税 9,384 / 合計 103,224）から写した。ledgerChecks の計算結果をそのまま期待値にしていない。

const SAMPLE = [
  ['A-1001', 'コピー用紙 A4 500枚', '20', '箱', '2,400', '48,000', '2026年10月20日'],
  ['B-2050', 'ボールペン 黒 0.5mm', '100', '本', '120', '12,000', '2026年10月20日'],
  ['C-3300', 'クリアファイル A4 50枚入', '30', '袋', '680', '20,400', '2026年10月20日'],
  ['D-4120', 'ホッチキス針 No.10', '40', '箱', '150', '6,000', '2026年10月20日'],
  ['E-5005', 'ガムテープ 50mm', '24', '巻', '310', '7,440', '2026/10/13'],
].map(([品番, 品名, 数量, 単位, 単価, 金額, 納期]) => ({
  ファイル: 'sample-order.pdf',
  受注日: '2026年10月6日',
  得意先: '株式会社サンプル商事',
  注文番号: 'PO-2026-1015',
  品番,
  品名,
  数量,
  単位,
  単価,
  金額,
  納期,
  備考: '',
}));
const SAMPLE_TOTALS = { 小計: '93,840', 消費税: '9,384', 合計: '103,224' };

test('サンプル注文書（正解どおり）→ 全行問題なし・小計と一致', () => {
  const r = checkLedger(SAMPLE, { 'sample-order.pdf': SAMPLE_TOTALS });
  assert.deepEqual(r.rows, [[], [], [], [], []]);
  assert.deepEqual(r.files, [
    { file: 'sample-order.pdf', status: 'ok', basis: 'subtotal', sum: 93840, printed: 93840 },
  ]);
});

test('単価を読み違えた行（2,400→2,000）→ その行だけ amount、合計も不一致', () => {
  const rows = SAMPLE.map((r, i) => (i === 0 ? { ...r, 単価: '2,000' } : r));
  const r = checkLedger(rows, { 'sample-order.pdf': SAMPLE_TOTALS });
  assert.deepEqual(r.rows[0], ['amount']);
  assert.deepEqual(r.rows.slice(1), [[], [], [], []]);
  // 金額 48,000 自体は正しく写っているので合計は一致する＝行チェックだけが捕まえる
  assert.equal(r.files[0].status, 'ok');
});

test('1 行読み落とし → 行は全部正しいのに合計が合わない（合計照合だけが捕まえる）', () => {
  const r = checkLedger(SAMPLE.slice(0, 4), { 'sample-order.pdf': SAMPLE_TOTALS });
  assert.deepEqual(r.rows, [[], [], [], []]);
  assert.equal(r.files[0].status, 'mismatch');
  assert.equal(r.files[0].sum, 86400);
  assert.equal(r.files[0].printed, 93840);
});

test('集計行を明細にしてしまった → 合計が倍近くになり不一致', () => {
  const bad = {
    ...SAMPLE[0],
    品番: '',
    品名: '小計',
    数量: '',
    単位: '',
    単価: '',
    金額: '93,840',
  };
  const r = checkLedger([...SAMPLE, bad], { 'sample-order.pdf': SAMPLE_TOTALS });
  assert.equal(r.files[0].status, 'mismatch');
  assert.deepEqual(r.rows[5], ['no_qty']);
});

test('合計だけの注文書：税抜一致・税込（10%/8%）一致・不一致', () => {
  const rows = [{ 品名: 'x', 数量: '1', 単価: '1000', 金額: '1,000' }];
  assert.equal(checkTotals(rows, { 合計: '1000' }).basis, 'total');
  assert.deepEqual(checkTotals(rows, { 合計: '1,100' }).basis, 'total_incl');
  assert.deepEqual(checkTotals(rows, { 合計: '1,080' }).basis, 'total_incl');
  assert.equal(checkTotals(rows, { 合計: '1,200' }).status, 'mismatch');
  // 合計と消費税がある → 合計−消費税 と照合
  assert.deepEqual(checkTotals(rows, { 合計: '1,100', 消費税: '100' }), {
    status: 'ok',
    basis: 'total_ex',
    sum: 1000,
    printed: 1000,
  });
});

test('照合できないときは OK と言わない：合計欄なし／金額が読めない行あり／金額のない注文書', () => {
  const rows = [
    { 品名: 'a', 数量: '1', 単価: '100', 金額: '100' },
    { 品名: 'b', 数量: '2', 単価: '50', 金額: '100' },
  ];
  assert.equal(checkTotals(rows, null).status, 'no_total');
  assert.equal(checkTotals(rows, { 小計: '', 合計: '' }).status, 'no_total');
  assert.equal(checkTotals([rows[0], { ...rows[1], 金額: '' }], { 小計: '200' }).status, 'partial');
  assert.equal(
    checkTotals([{ 品名: 'a', 数量: '3', 単価: '', 金額: '' }], { 小計: '' }).status,
    'no_amount',
  );
});

test('値引き行（△・▲・マイナス）は負数として合計に入る', () => {
  const rows = [
    { 品名: 'a', 数量: '10', 単価: '1,000', 金額: '10,000' },
    { 品名: '値引', 数量: '1', 単価: '△500', 金額: '△500' },
  ];
  assert.deepEqual(
    checkLedger(
      rows.map((r) => ({ ...r, ファイル: 'f' })),
      { f: { 小計: '9,500' } },
    ).files[0],
    {
      file: 'f',
      status: 'ok',
      basis: 'subtotal',
      sum: 9500,
      printed: 9500,
    },
  );
  assert.equal(parseNum('▲1,200'), -1200);
  assert.equal(parseNum('-30'), -30);
});

test('数値：全角・円記号・小数単価、丸め差 1 円未満は許す', () => {
  assert.equal(parseNum('１，２３４'), 1234);
  assert.equal(parseNum('¥2,400円'), 2400);
  assert.equal(parseNum(''), null);
  assert.ok(Number.isNaN(parseNum('20箱')));
  // 単価 12.5 × 3 = 37.5 → 金額 37 / 38 どちらも可（切捨て・四捨五入は会社次第）
  assert.deepEqual(checkRow({ 品名: 'x', 数量: '3', 単価: '12.5', 金額: '37' }), []);
  assert.deepEqual(checkRow({ 品名: 'x', 数量: '3', 単価: '12.5', 金額: '38' }), []);
  assert.deepEqual(checkRow({ 品名: 'x', 数量: '3', 単価: '12.5', 金額: '39' }), ['amount']);
});

test('数字として読めない値・品名や数量の空欄', () => {
  assert.deepEqual(checkRow({ 品名: 'x', 数量: '20箱', 単価: '', 金額: '' }), ['number']);
  assert.deepEqual(checkRow({ 品名: '', 数量: '', 単価: '', 金額: '' }), ['no_item', 'no_qty']);
  // 金額も単価も無い注文書（数量だけ）は問題にしない
  assert.deepEqual(checkRow({ 品名: 'x', 数量: '5', 単価: '', 金額: '' }), []);
});

test('日付：各書式が読める・年なし納期は受注日の年で補う・納期が受注日より前', () => {
  assert.deepEqual(parseDate('2026年10月6日'), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(parseDate('2026/10/06'), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(parseDate('2026-10-06'), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(parseDate('令和8年10月6日'), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(parseDate('R8.10.6'), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(parseDate('２０２６／１０／０６'), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(parseDate('10月13日(火)', 2026), { y: 2026, m: 10, d: 13 });
  assert.equal(parseDate('10/13'), null, '年が補えないときは読めない扱い');
  assert.equal(parseDate('2026年2月30日'), null, '存在しない日');
  const base = { 品名: 'x', 数量: '1', 単価: '', 金額: '', 受注日: '2026年10月6日' };
  assert.deepEqual(checkRow({ ...base, 納期: '10/13' }), []);
  assert.deepEqual(checkRow({ ...base, 納期: '2026/10/01' }), ['due_before_order']);
  assert.deepEqual(checkRow({ ...base, 納期: '至急' }), ['date']);
  assert.deepEqual(checkRow({ ...base, 納期: '' }), []);
});

test('複数ファイル：ファイルごとに照合し、片方の不一致がもう片方に波及しない', () => {
  const a = SAMPLE;
  const b = [{ ファイル: 'b.xlsx', 品名: 'y', 数量: '2', 単価: '500', 金額: '1,000' }];
  const r = checkLedger([...a, ...b], {
    'sample-order.pdf': SAMPLE_TOTALS,
    'b.xlsx': { 小計: '1,500', 消費税: '', 合計: '' },
  });
  assert.deepEqual(
    r.files.map((f) => [f.file, f.status]),
    [
      ['sample-order.pdf', 'ok'],
      ['b.xlsx', 'mismatch'],
    ],
  );
  assert.equal(r.rows.length, 6);
});

test('parseTotals：モデル返答から合計欄を取り出す（フェンス付き・欠落・壊れた JSON）', () => {
  const body = '{"rows":[],"totals":{"小計":"93,840","消費税":"9,384","合計":"103,224"}}';
  assert.deepEqual(parseTotals(body), SAMPLE_TOTALS);
  assert.deepEqual(parseTotals('```json\n' + body + '\n```'), SAMPLE_TOTALS);
  assert.deepEqual(parseTotals('{"rows":[],"totals":{"合計":"1000"}}'), {
    小計: '',
    消費税: '',
    合計: '1000',
  });
  assert.equal(parseTotals('{"rows":[]}'), null);
  assert.equal(parseTotals('not json'), null);
});

test('プロンプトが合計欄を「写す・計算しない」と指示している', () => {
  const p = buildDemoOrderPrompt('TEXT');
  assert.match(p, /"totals":\{"小計":"","消費税":"","合計":""\}/);
  assert.match(p, /totals に原文どおり写す/);
  assert.match(p, /明細から計算しない/);
});
