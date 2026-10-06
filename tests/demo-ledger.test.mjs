import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeRows } from '../functions/api/demo-order-extract.js';
import {
  LEDGER_COLUMNS,
  buildDemoOrderPrompt,
} from '../functions/api/_lib/buildDemoOrderPrompt.js';
import {
  demoProvider,
  modelFor,
  CHAT_ENDPOINT,
  DEMO_PROVIDER,
  DEMO_FALLBACK_LABEL,
  TIERS,
} from '../functions/api/_lib/models.js';

// 受発注デモ（2026-10-06 改修）の三つの約束を固定する：
//   ① 出力は固定列の受注台帳（列名がモデルの気分で揺れない）
//   ② 専用鍵 DEMO_API_KEY だけ入れれば SiliconFlow に向く（端点/モデルの env を要求しない）
//   ③ ページに表示する「使用するAI」と、実際の送り先が同じ関数から出る
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('① 列は「ファイル」＋固定の受注台帳列で、モデルが足した列は捨てる', () => {
  const { columns, rows } = mergeRows([
    {
      name: 'a.pdf',
      rows: [{ 品名: 'ボールペン', 数量: '100', 商品コード: 'X-1', 色: '黒' }],
    },
  ]);
  assert.deepEqual(columns, ['ファイル', ...LEDGER_COLUMNS]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].品名, 'ボールペン');
  assert.equal(rows[0].得意先, '', '欠けた列は空で埋める');
  assert.ok(!('色' in rows[0]) && !('商品コード' in rows[0]), '固定列以外は出さない');
});

test('① ファイルが違っても列は同じ（以前は品名/商品名で表がバラけた）', () => {
  const { columns, rows } = mergeRows([
    { name: 'a.pdf', rows: [{ 品名: 'A', 数量: '1' }] },
    { name: 'b.xlsx', rows: [{ 品名: 'B', 金額: '500' }] },
  ]);
  assert.equal(columns.length, 1 + LEDGER_COLUMNS.length);
  assert.deepEqual(Object.keys(rows[0]), Object.keys(rows[1]));
});

test('① 固定列が全部空の行は捨てる（列名を外した応答で空行を作らない）', () => {
  const { rows } = mergeRows([
    {
      name: 'a.pdf',
      rows: [{ product: 'pen', qty: 3 }, null, 'junk', { 品名: '  ' }, { 品名: 'OK' }],
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].品名, 'OK');
});

test('① プロンプトは固定列を全部列挙し、計算させず、集計行を除かせる', () => {
  const p = buildDemoOrderPrompt('TEXT');
  for (const c of LEDGER_COLUMNS) assert.ok(p.includes(c), `プロンプトに列 ${c} が無い`);
  assert.match(p, /計算しない/);
  assert.match(p, /小計・消費税・合計/);
  assert.match(p, /得意先＝注文書を発行した会社/);
  // 本番 E2E で「宛先を得意先にする」誤りが出た。その錨（御中/様）を消させない。
  assert.match(p, /「御中」「様」が付いた会社は宛先/);
  assert.ok(p.includes('TEXT'));
});

test('② 鍵なし → 無効（apiKey 空）', () => {
  const r = demoProvider({});
  assert.equal(r.apiKey, '');
  assert.equal(r.dedicated, false);
});

test('② 共有鍵だけ → DashScope ＋ Qwen 表示 ＋ TIERS のモデル', () => {
  const env = { QWEN_API_KEY: 'q' };
  const r = demoProvider(env);
  assert.equal(r.endpoint, CHAT_ENDPOINT);
  assert.equal(r.label, DEMO_FALLBACK_LABEL);
  assert.equal(modelFor('demoExtract', env), TIERS.fast);
});

test('② DEMO_API_KEY だけ入れれば SiliconFlow 国際站 ＋ Gemma（端点/モデルの env 不要）', () => {
  const env = { QWEN_API_KEY: 'q', DEMO_API_KEY: 'sf' };
  const r = demoProvider(env);
  assert.equal(r.apiKey, 'sf');
  assert.equal(r.endpoint, 'https://api.siliconflow.com/v1/chat/completions');
  assert.ok(!r.endpoint.includes('.cn'), '国際站（.com）でなければならない');
  assert.equal(modelFor('demoExtract', env), DEMO_PROVIDER.model);
  assert.equal(modelFor('demoVision', env), DEMO_PROVIDER.visionModel);
  assert.equal(r.label, DEMO_PROVIDER.label);
});

test('② 専用鍵があっても他のツールのモデルは変わらない', () => {
  const env = { QWEN_API_KEY: 'q', DEMO_API_KEY: 'sf' };
  assert.equal(modelFor('translate', env), TIERS.strong);
  assert.equal(modelFor('summary', env), TIERS.balanced);
});

test('③ env でモデルを上書きしたら、表示もその id（名称を偽らない）', () => {
  const env = { DEMO_API_KEY: 'sf', DEMO_MODEL: 'openai/gpt-oss-120b' };
  assert.equal(modelFor('demoExtract', env), 'openai/gpt-oss-120b');
  assert.equal(demoProvider(env).label, 'openai/gpt-oss-120b');
});

test('③ 端点は GET で送り先名を返し、POST 応答にも ai を載せる', () => {
  const src = readFileSync(path.join(ROOT, 'functions/api/demo-order-extract.js'), 'utf8');
  assert.match(src, /request\.method === 'GET'[\s\S]{0,120}aiRoute\.label/);
  assert.match(src, /ai: aiRoute\.label/);
  // 端点 URL をここに直書きしない（送り先は demoProvider だけが決める）。
  assert.ok(!/siliconflow|dashscope/i.test(src.replace(/^\s*\/\/.*$/gm, '')));
});

test('⑤ サンプル注文書が公開パスにあり、ページから参照されている', () => {
  assert.ok(existsSync(path.join(ROOT, 'solutions/samples/sample-order.pdf')));
  const html = readFileSync(path.join(ROOT, 'solutions/order-to-ledger.html'), 'utf8');
  assert.match(html, /href="solutions\/samples\/sample-order\.pdf"/);
  const js = readFileSync(path.join(ROOT, 'js/order-to-ledger-demo.js'), 'utf8');
  assert.match(js, /fetch\('\/solutions\/samples\/sample-order\.pdf'\)/);
});
