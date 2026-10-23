// 受注台帳の自動チェック（2026-10-23）。書式に依存しない検算だけを行う純関数。
//
// なぜ効くか：プロンプトは AI に「写すだけ・計算しない」を課している（buildDemoOrderPrompt.js）。
// 数量・単価・金額、そして注文書の小計／合計は**それぞれ独立に原文から写された値**なので、
//   数量×単価＝金額、明細の金額の合計＝注文書の小計
// が合わなければ、どれかを読み違えた（または行を落とした・集計行を明細にした）ことになる。
// 新しい書式が初めて来ても、この照合は書式を知らずに働く＝書式ごとの調整の前に置く安全網。
//
// 判定できないものは「OK」と言わない：照合に使える合計欄が無い・金額が読めない行がある場合は
// それぞれ別の状態として返し、画面で「照合していない」と見せる（黙って緑にしない）。
//
// 返すのはコードだけ。文言は画面側（js/main.js の o2l_chk_*、三語）。

const NUM_COLS = ['数量', '単価', '金額'];

/** '1,234' '¥1,234' '△500' '１２' → 数値。空は null、数字として読めないものは NaN。 */
export function parseNum(raw) {
  let s = String(raw == null ? '' : raw)
    .replace(/[０-９．，－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s,，¥￥円]/g, '');
  if (!s) return null;
  let sign = 1;
  if (/^[-−△▲]/.test(s)) {
    sign = -1;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return sign * Number(s);
}

function validYmd(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? { y, m, d }
    : null;
}

/**
 * 日付 → {y,m,d}。読めなければ null。年の無い「10/13」「10月13日」は refYear で補う（無ければ null）。
 * 対応：2026年10月6日 / 2026/10/06 / 2026-10-06 / 2026.10.6 / 令和8年10月6日 / R8.10.6
 */
export function parseDate(raw, refYear) {
  const s = String(raw == null ? '' : raw)
    .replace(/[０-９／．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '')
    .replace(/\(.\)|（.）/g, ''); // 曜日 (月)
  let m = s.match(/^(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})日?$/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/^(?:令和|R\.?)(\d{1,2}|元)[年/.-](\d{1,2})[月/.-](\d{1,2})日?$/);
  if (m) return validYmd(2018 + (m[1] === '元' ? 1 : +m[1]), +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[月/](\d{1,2})日?$/);
  if (m && refYear) return validYmd(refYear, +m[1], +m[2]);
  return null;
}

const ymdKey = (d) => d.y * 10000 + d.m * 100 + d.d;

/** 1 行 → 問題コードの配列（無ければ []）。 */
export function checkRow(row) {
  const codes = [];
  const n = {};
  for (const c of NUM_COLS) {
    n[c] = parseNum(row[c]);
    if (Number.isNaN(n[c])) codes.push('number');
  }
  if (!String(row['品名'] || '').trim()) codes.push('no_item');
  if (n['数量'] === null) codes.push('no_qty');
  // 金額は数量×単価を円未満で丸めたもの。丸め方（切捨て/四捨五入）は会社ごとなので 1 円未満の差は許す。
  if ([n['数量'], n['単価'], n['金額']].every((v) => typeof v === 'number' && !Number.isNaN(v))) {
    if (Math.abs(n['数量'] * n['単価'] - n['金額']) >= 1) codes.push('amount');
  }
  const order = row['受注日'] ? parseDate(row['受注日']) : null;
  if (row['受注日'] && !order) codes.push('date');
  if (row['納期']) {
    const due = parseDate(row['納期'], order && order.y);
    if (!due) codes.push('date');
    else if (order && ymdKey(due) < ymdKey(order)) codes.push('due_before_order');
  }
  return [...new Set(codes)];
}

/**
 * 1 ファイル分：明細の金額の合計 と 注文書に印字された小計／合計 の照合。
 * totals = { 小計, 消費税, 合計 }（AI が原文から写した文字列、無ければ空）。
 * status:
 *   'ok'        一致（basis＝何と照合したか）
 *   'mismatch'  不一致
 *   'no_total'  注文書に照合できる合計欄が無い（照合していない）
 *   'partial'   金額が読めない行がある（照合していない）
 *   'no_amount' 金額が 1 行も無い注文書（数量だけの注文書。照合の対象外）
 */
export function checkTotals(rows, totals) {
  const amounts = rows.map((r) => parseNum(r['金額']));
  const known = amounts.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!known.length) return { status: 'no_amount' };
  const sum = known.reduce((a, b) => a + b, 0);
  if (known.length < amounts.length) return { status: 'partial', sum };

  const t = totals || {};
  const sub = parseNum(t['小計']);
  const tax = parseNum(t['消費税']);
  const total = parseNum(t['合計']);
  const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
  const near = (a, b) => Math.abs(a - b) < 1;

  if (isNum(sub))
    return { status: near(sum, sub) ? 'ok' : 'mismatch', basis: 'subtotal', sum, printed: sub };
  if (isNum(total) && isNum(tax)) {
    const ex = total - tax;
    return { status: near(sum, ex) ? 'ok' : 'mismatch', basis: 'total_ex', sum, printed: ex };
  }
  if (isNum(total)) {
    if (near(sum, total)) return { status: 'ok', basis: 'total', sum, printed: total };
    // 合計しか無い注文書は税込のことが多い：10%・8% の税込額（端数は切捨て〜四捨五入）なら一致とみなす
    for (const rate of [1.1, 1.08]) {
      if (Math.abs(sum * rate - total) <= 1)
        return { status: 'ok', basis: 'total_incl', sum, printed: total };
    }
    return { status: 'mismatch', basis: 'total', sum, printed: total };
  }
  return { status: 'no_total', sum };
}

/**
 * 合并後の行（各行に「ファイル」列）と、ファイル名 → totals の対応から全体のチェック結果を作る。
 * 返り値：{ rows: [[code...], ...]（行と同じ順）, files: [{ file, status, basis?, sum?, printed? }] }
 */
export function checkLedger(rows, totalsByFile) {
  const byFile = new Map();
  for (const r of rows) {
    const k = r['ファイル'] || '';
    if (!byFile.has(k)) byFile.set(k, []);
    byFile.get(k).push(r);
  }
  return {
    rows: rows.map(checkRow),
    files: [...byFile.entries()].map(([file, rs]) => ({
      file,
      ...checkTotals(rs, (totalsByFile || {})[file]),
    })),
  };
}
