/* 受発注ランディングのデモ（Stage B）：ファイルをブラウザ内で解析して表に起こし、
   Excel で書き出す。ここでは LLM を呼ばない —— 原本ファイルはサーバーに送らない、を
   実装で担保するのが目的（信頼文案の裏付け）。AI による受注台帳への整形は Stage C。

   pdf.js / XLSX はグローバル（UMD）。このスクリプトより前に <script> で読み込む。 */
/* global pdfjsLib, XLSX */
(function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024; // 5MB
  var MAX_PDF_PAGES = 5; // Stage C でプラン別に再制限（匿名1ページ等）
  var MAX_ROWS_SHOWN = 100; // 表示だけ間引く（ダウンロードは全行）

  var drop = document.getElementById('o2lDrop');
  var fileInput = document.getElementById('o2lFile');
  if (!drop || !fileInput) return; // このページ以外では何もしない

  var statusEl = document.getElementById('o2lStatus');
  var resultEl = document.getElementById('o2lResult');
  var tableWrap = document.getElementById('o2lTableWrap');
  var downloadBtn = document.getElementById('o2lDownload');
  var lastRows = null;

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // 文言は DOM 内の data-i18n 済み要素を出し分ける（JS に文言をハードコードしない）。
  function showStatus(key) {
    if (!statusEl) return;
    var msgs = statusEl.querySelectorAll('[data-msg]');
    for (var i = 0; i < msgs.length; i++) {
      msgs[i].hidden = msgs[i].getAttribute('data-msg') !== key;
    }
    statusEl.hidden = !key;
  }

  drop.addEventListener('click', function () {
    fileInput.click();
  });
  drop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  drop.addEventListener('dragover', function (e) {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', function () {
    drop.classList.remove('is-over');
  });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    drop.classList.remove('is-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function ext(name) {
    var m = /\.([^.]+)$/.exec(name.toLowerCase());
    return m ? m[1] : '';
  }

  function handleFile(file) {
    resultEl.hidden = true;
    if (typeof resetAi === 'function') resetAi(); // 新しいファイルなら AI 整形結果もリセット
    if (file.size > MAX_BYTES) {
      showStatus('toobig');
      return;
    }
    var e = ext(file.name);
    if (['xlsx', 'xls', 'csv', 'pdf'].indexOf(e) === -1) {
      showStatus('type');
      return;
    }
    showStatus('parsing');
    file
      .arrayBuffer()
      .then(function (buf) {
        return e === 'pdf' ? parsePdf(buf) : parseSheet(buf);
      })
      .then(function (rows) {
        if (!rows || !rows.length) {
          showStatus('parse');
          return;
        }
        lastRows = rows;
        renderTable(rows);
        showStatus(null);
        resultEl.hidden = false;
      })
      .catch(function () {
        showStatus('parse');
      });
  }

  function parseSheet(buf) {
    var wb = XLSX.read(buf, { type: 'array' });
    var sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  }

  function parsePdf(buf) {
    if (typeof pdfjsLib === 'undefined') return Promise.reject(new Error('pdf.js'));
    return pdfjsLib
      .getDocument({ data: buf.slice(0), isEvalSupported: false })
      .promise.then(function (pdf) {
        var n = Math.min(pdf.numPages, MAX_PDF_PAGES);
        var out = [];
        var chain = Promise.resolve();
        var _loop = function (p) {
          chain = chain
            .then(function () {
              return pdf.getPage(p);
            })
            .then(function (page) {
              return page.getTextContent();
            })
            .then(function (content) {
              // 同じ y 座標のアイテムを 1 行にまとめる簡易テーブル化。
              var lines = {};
              content.items.forEach(function (it) {
                if (!it.str) return;
                var y = Math.round(it.transform[5]);
                (lines[y] = lines[y] || []).push(it.str);
              });
              Object.keys(lines)
                .sort(function (a, b) {
                  return b - a;
                })
                .forEach(function (y) {
                  var text = lines[y].join(' ').trim();
                  if (text) out.push([text]);
                });
            });
        };
        for (var p = 1; p <= n; p++) _loop(p);
        return chain.then(function () {
          return out;
        });
      });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function renderTable(rows) {
    var shown = rows.slice(0, MAX_ROWS_SHOWN);
    var maxCols = 0;
    shown.forEach(function (r) {
      if (r.length > maxCols) maxCols = r.length;
    });
    var html = '<table class="o2l-table"><tbody>';
    shown.forEach(function (r) {
      html += '<tr>';
      for (var c = 0; c < maxCols; c++) {
        html += '<td>' + escapeHtml(r[c] == null ? '' : String(r[c])) + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
  }

  downloadBtn.addEventListener('click', function () {
    if (!lastRows) return;
    var ws = XLSX.utils.aoa_to_sheet(lastRows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'order-to-ledger.xlsx');
  });

  // ── Stage C：AIで受注台帳（品名・数量・単価・金額）に整形 ──────────────────
  // ブラウザ内で解析した「テキスト」だけを /api/demo-order-extract に送る（原本ファイルは送らない）。
  // トークンは window.sdfDemoToken（ページ末尾の module が設定：会員=会員トークン、未ログイン=匿名）。
  var extractBtn = document.getElementById('o2lExtract');
  var aiStatusEl = document.getElementById('o2lAiStatus');
  var ledgerEl = document.getElementById('o2lLedger');
  var ledgerWrap = document.getElementById('o2lLedgerWrap');
  var ledgerDownloadBtn = document.getElementById('o2lLedgerDownload');
  var LEDGER_COLS = ['品名', '数量', '単価', '金額'];
  var lastLedger = null;

  function showAiStatus(key) {
    if (!aiStatusEl) return;
    var msgs = aiStatusEl.querySelectorAll('[data-msg]');
    for (var i = 0; i < msgs.length; i++) {
      msgs[i].hidden = msgs[i].getAttribute('data-msg') !== key;
    }
    aiStatusEl.hidden = !key;
  }

  // 新しいファイルを読み込んだら AI 整形結果はリセット（handleFile から呼ぶ）。
  function resetAi() {
    if (ledgerEl) ledgerEl.hidden = true;
    lastLedger = null;
    showAiStatus(null);
    if (extractBtn) extractBtn.disabled = false;
  }

  // サーバのエラーコード → 表示メッセージのキー。
  function aiStatusKeyFor(status, code) {
    if (status === 503 || code === 'demo_disabled') return 'disabled';
    if (code === 'anon_used_up') return 'anon_used_up';
    if (code === 'member_used_up') return 'member_used_up';
    if (code === 'global_daily' || code === 'ip_daily' || code === 'counter_unavailable')
      return 'daily';
    if (code === 'too_long' || code === 'too_many_pages' || code === 'empty') return 'toobig';
    if (status === 401) return 'login';
    return 'error';
  }

  function rowsToText(rows) {
    return rows
      .map(function (r) {
        return r
          .map(function (c) {
            return c == null ? '' : String(c);
          })
          .join('\t');
      })
      .join('\n');
  }

  function renderLedger(rows) {
    var html = '<table class="o2l-table"><thead><tr>';
    LEDGER_COLS.forEach(function (c) {
      html += '<th>' + escapeHtml(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr>';
      LEDGER_COLS.forEach(function (c) {
        html += '<td>' + escapeHtml(row && row[c] != null ? String(row[c]) : '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    ledgerWrap.innerHTML = html;
  }

  if (extractBtn) {
    extractBtn.addEventListener('click', function () {
      if (!lastRows || !lastRows.length) return;
      if (typeof window.sdfDemoToken !== 'function') {
        showAiStatus('login');
        return;
      }
      var isMember = typeof window.sdfDemoIsMember === 'function' && window.sdfDemoIsMember();
      var cap = isMember ? 10000 : 3000;
      var text = rowsToText(lastRows);
      var truncated = text.length > cap;
      if (truncated) text = text.slice(0, cap);

      extractBtn.disabled = true;
      showAiStatus('working');
      Promise.resolve(window.sdfDemoToken())
        .then(function (token) {
          if (!token) throw { __status: 401 };
          return fetch('/api/demo-order-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ text: text }),
          });
        })
        .then(function (res) {
          return res.json().then(function (body) {
            return { status: res.status, ok: res.ok, body: body };
          });
        })
        .then(function (r) {
          extractBtn.disabled = false;
          if (!r.ok) {
            showAiStatus(aiStatusKeyFor(r.status, r.body && r.body.error));
            return;
          }
          var rows = (r.body && r.body.ledger) || [];
          if (!rows.length) {
            showAiStatus('error');
            return;
          }
          lastLedger = rows;
          renderLedger(rows);
          if (ledgerEl) ledgerEl.hidden = false;
          showAiStatus(truncated ? 'toobig' : null);
        })
        .catch(function (e) {
          extractBtn.disabled = false;
          showAiStatus(aiStatusKeyFor(e && e.__status, null));
        });
    });
  }

  if (ledgerDownloadBtn) {
    ledgerDownloadBtn.addEventListener('click', function () {
      if (!lastLedger) return;
      var aoa = [LEDGER_COLS.slice()];
      lastLedger.forEach(function (row) {
        aoa.push(
          LEDGER_COLS.map(function (c) {
            return row && row[c] != null ? row[c] : '';
          }),
        );
      });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '受注台帳');
      XLSX.writeFile(wb, 'juchu-daicho.xlsx');
    });
  }
})();
