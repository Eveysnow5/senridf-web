/* 受発注ランディングのデモ（バッチ対応）：複数ファイルをブラウザ内で解析してテキスト化し、
   /api/demo-order-extract に送って AI が各ファイルを構造化 → 1 枚に合并 → Excel で書き出す。
   原本ファイルはサーバーに送らない（抽出したテキストのみ送る＝信頼文案の裏付け）。
   トークンは window.sdfDemoToken（会員=会員トークン、未ログイン=匿名）。

   pdf.js / XLSX はグローバル（UMD）。このスクリプトより前に <script> で読み込む。 */
/* global pdfjsLib, XLSX */
(function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024; // 1 ファイル 5MB
  var MAX_PDF_PAGES = 5; // 1 ファイル 先頭 5 ページのみ読む（数百ページ対策）
  var MAX_FILES = 10; // 1 バッチ最大 10 ファイル
  var MAX_ROWS_SHOWN = 200; // 表示だけ間引く（ダウンロードは全行）

  var drop = document.getElementById('o2lDrop');
  var fileInput = document.getElementById('o2lFile');
  if (!drop || !fileInput) return; // このページ以外では何もしない

  var statusEl = document.getElementById('o2lStatus');
  var resultEl = document.getElementById('o2lResult');
  var fileListEl = document.getElementById('o2lFileList');
  var extractBtn = document.getElementById('o2lExtract');
  var aiStatusEl = document.getElementById('o2lAiStatus');
  var ledgerEl = document.getElementById('o2lLedger');
  var ledgerWrap = document.getElementById('o2lLedgerWrap');
  var ledgerDownloadBtn = document.getElementById('o2lLedgerDownload');

  var lastFiles = []; // [{name, text, pageCount}]
  var lastMerged = null; // {columns, rows}

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ── 文言表示（DOM 内の data-i18n 済み要素を出し分け。JS に文言をハードコードしない）──
  function showStatus(key) {
    toggleMsgs(statusEl, key);
  }
  function showAiStatus(key) {
    toggleMsgs(aiStatusEl, key);
  }
  function toggleMsgs(host, key) {
    if (!host) return;
    var msgs = host.querySelectorAll('[data-msg]');
    for (var i = 0; i < msgs.length; i++) {
      msgs[i].hidden = msgs[i].getAttribute('data-msg') !== key;
    }
    host.hidden = !key;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function ext(name) {
    var m = /\.([^.]+)$/.exec(name.toLowerCase());
    return m ? m[1] : '';
  }

  // ── ドラッグ&ドロップ / 選択 ────────────────────────────────────────────────
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
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files.length) handleFiles(fileInput.files);
  });

  // ── 解析 ────────────────────────────────────────────────────────────────────
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
          return { rows: out, pageCount: n };
        });
      });
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

  // 1 ファイルをブラウザ内で解析 → {name, text, pageCount} または null（読めない/空）。
  function parseFile(file) {
    var e = ext(file.name);
    if (file.size > MAX_BYTES) return Promise.resolve({ skip: 'toobig', name: file.name });
    if (['xlsx', 'xls', 'csv', 'pdf'].indexOf(e) === -1)
      return Promise.resolve({ skip: 'type', name: file.name });
    return file
      .arrayBuffer()
      .then(function (buf) {
        return e === 'pdf'
          ? parsePdf(buf)
          : Promise.resolve({ rows: parseSheet(buf), pageCount: 0 });
      })
      .then(function (r) {
        var rows = r.rows;
        if (!rows || !rows.length)
          return { skip: e === 'pdf' ? 'scanned' : 'parse', name: file.name };
        return {
          name: file.name,
          text: rowsToText(rows),
          pageCount: r.pageCount,
          rowCount: rows.length,
        };
      })
      .catch(function (err) {
        console.error('[order-to-ledger] 解析失败:', file.name, err);
        return { skip: 'parse', name: file.name };
      });
  }

  function handleFiles(fileList) {
    resetAi();
    resultEl.hidden = true;
    var files = Array.prototype.slice.call(fileList, 0, MAX_FILES);
    showStatus('parsing');
    Promise.all(files.map(parseFile))
      .then(function (results) {
        var ok = results.filter(function (r) {
          return r && r.text;
        });
        lastFiles = ok;
        if (!ok.length) {
          // すべて読めなかった：PDF スキャンが多ければ scanned、それ以外は parse。
          var anyScanned = results.some(function (r) {
            return r && r.skip === 'scanned';
          });
          showStatus(anyScanned ? 'scanned' : 'parse');
          return;
        }
        renderFileList(ok, results.length - ok.length);
        showStatus(null);
        resultEl.hidden = false;
      })
      .catch(function (err) {
        console.error('[order-to-ledger] バッチ解析失败:', err);
        showStatus('parse');
      });
  }

  function renderFileList(files, skipped) {
    var html = '<ul class="o2l-files">';
    files.forEach(function (f) {
      html += '<li>' + escapeHtml(f.name || 'file') + '</li>';
    });
    html += '</ul>';
    if (skipped > 0) {
      // 読めなかった数だけ小さく添える（文言は data-i18n、数字だけ差し込む）。
      html +=
        '<p class="o2l-files__skip"><span data-i18n="o2l_files_skipped"></span> ' +
        skipped +
        '</p>';
    }
    fileListEl.innerHTML = html;
    if (window.sdfApplyI18n) window.sdfApplyI18n(); // 差し込んだ data-i18n を翻訳
  }

  // ── AI 整形（バッチ → 合并）──────────────────────────────────────────────────
  function resetAi() {
    if (ledgerEl) ledgerEl.hidden = true;
    lastMerged = null;
    showAiStatus(null);
    if (extractBtn) extractBtn.disabled = false;
  }

  function aiStatusKeyFor(status, code) {
    if (status === 503 || code === 'demo_disabled') return 'disabled';
    if (code === 'anon_used_up') return 'anon_used_up';
    if (code === 'member_used_up') return 'member_used_up';
    if (code === 'global_daily' || code === 'ip_daily' || code === 'counter_unavailable')
      return 'daily';
    if (
      code === 'too_long' ||
      code === 'too_many_pages' ||
      code === 'too_many_files' ||
      code === 'empty'
    )
      return 'toobig';
    if (status === 401) return 'login';
    return 'error';
  }

  function renderMerged(columns, rows) {
    var html = '<table class="o2l-table"><thead><tr>';
    columns.forEach(function (c) {
      html += '<th>' + escapeHtml(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.slice(0, MAX_ROWS_SHOWN).forEach(function (row) {
      html += '<tr>';
      columns.forEach(function (c) {
        html += '<td>' + escapeHtml(row[c] != null ? String(row[c]) : '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    ledgerWrap.innerHTML = html;
  }

  if (extractBtn) {
    extractBtn.addEventListener('click', function () {
      if (!lastFiles.length) return;
      if (typeof window.sdfDemoToken !== 'function') {
        showAiStatus('login');
        return;
      }
      var isMember = typeof window.sdfDemoIsMember === 'function' && window.sdfDemoIsMember();
      var cap = isMember ? 10000 : 3000;
      var truncated = false;
      var items = lastFiles.map(function (f) {
        if (f.text.length > cap) truncated = true;
        return { name: f.name, text: f.text.slice(0, cap) };
      });

      extractBtn.disabled = true;
      showAiStatus('working');
      Promise.resolve(window.sdfDemoToken())
        .then(function (token) {
          if (!token) throw { __status: 401 };
          return fetch('/api/demo-order-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ items: items }),
          });
        })
        .then(function (res) {
          return res.json().then(function (b) {
            return { status: res.status, ok: res.ok, body: b };
          });
        })
        .then(function (r) {
          extractBtn.disabled = false;
          if (!r.ok) {
            showAiStatus(aiStatusKeyFor(r.status, r.body && r.body.error));
            return;
          }
          var columns = (r.body && r.body.columns) || [];
          var rows = (r.body && r.body.rows) || [];
          if (!rows.length) {
            showAiStatus('error');
            return;
          }
          lastMerged = { columns: columns, rows: rows };
          renderMerged(columns, rows);
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
      if (!lastMerged) return;
      var cols = lastMerged.columns;
      var aoa = [cols.slice()];
      lastMerged.rows.forEach(function (row) {
        aoa.push(
          cols.map(function (c) {
            return row[c] != null ? row[c] : '';
          }),
        );
      });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '台帳');
      XLSX.writeFile(wb, 'daicho.xlsx');
    });
  }

  // 「無料で試す」CTA をデモ欄までスクロール。
  // ⚠️ このページは <base href="../"> なので、素の href="#demo" は根（トップページ）の
  //    #demo に飛んでしまう（base 基準で解決されるため）。JS で同ページ内スクロールする。
  var demoSection = document.getElementById('demo');
  var toDemoLinks = document.querySelectorAll('.o2l-to-demo');
  for (var d = 0; d < toDemoLinks.length; d++) {
    toDemoLinks[d].addEventListener('click', function (e) {
      if (!demoSection) return;
      e.preventDefault();
      demoSection.scrollIntoView({ behavior: 'smooth' });
    });
  }
})();
