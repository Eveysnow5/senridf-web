/* 受発注ランディングのデモ（バッチ + 画像OCR対応）：
   - 文字PDF/Excel/CSV：ブラウザ内で解析し、テキストのみ送る（原本ファイルは非送信）。
   - スキャンPDF/画像：文字レイヤーが無いので、画像を視覚モデル(通義千問VL)に送って読み取る。
     ⚠️ 画像は当社サーバー経由で Qwen に送信されるため、送信前に**確認ダイアログ**で同意を取る。
   端点：/api/demo-order-extract に items[]（text か image）を送信 → AI が構造化 → 1 枚に合并。
   トークンは window.sdfDemoToken（会員=会員トークン、未ログイン=匿名）。

   pdf.js / XLSX はグローバル（UMD）。このスクリプトより前に <script> で読み込む。 */
/* global pdfjsLib, XLSX */
(function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024;
  var MAX_PDF_PAGES = 5;
  var MAX_FILES = 10;
  var MAX_ROWS_SHOWN = 200;
  var IMG_MAX_W = 1500; // 画像は横 1500px まで縮小して送る（コスト/サイズ抑制）

  var drop = document.getElementById('o2lDrop');
  var fileInput = document.getElementById('o2lFile');
  if (!drop || !fileInput) return;

  var statusEl = document.getElementById('o2lStatus');
  var resultEl = document.getElementById('o2lResult');
  var fileListEl = document.getElementById('o2lFileList');
  var extractBtn = document.getElementById('o2lExtract');
  var aiStatusEl = document.getElementById('o2lAiStatus');
  var ledgerEl = document.getElementById('o2lLedger');
  var ledgerWrap = document.getElementById('o2lLedgerWrap');
  var ledgerDownloadBtn = document.getElementById('o2lLedgerDownload');

  var lastFiles = []; // [{name, text} | {name, image, needsVision:true}]
  var lastMerged = null;

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function toggleMsgs(host, key) {
    if (!host) return;
    var msgs = host.querySelectorAll('[data-msg]');
    for (var i = 0; i < msgs.length; i++) {
      msgs[i].hidden = msgs[i].getAttribute('data-msg') !== key;
    }
    host.hidden = !key;
  }
  function showStatus(key) {
    toggleMsgs(statusEl, key);
  }
  function showAiStatus(key) {
    toggleMsgs(aiStatusEl, key);
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

  // ── ドラッグ&ドロップ / 選択 ───────────────────────────────────────────────
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

  // ── 解析 ───────────────────────────────────────────────────────────────────
  function parseSheet(buf) {
    var wb = XLSX.read(buf, { type: 'array' });
    var sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  }

  function parsePdfText(buf) {
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
          return out;
        });
      });
  }

  // スキャンPDF：先頭ページを画像(dataURL)に。OCR は視覚モデル側。
  function pdfFirstPageToImage(buf) {
    return pdfjsLib
      .getDocument({ data: buf.slice(0), isEvalSupported: false })
      .promise.then(function (pdf) {
        return pdf.getPage(1);
      })
      .then(function (page) {
        var base = page.getViewport({ scale: 1 });
        var scale = base.width > IMG_MAX_W ? IMG_MAX_W / base.width : 1.5;
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        return page
          .render({ canvasContext: canvas.getContext('2d'), viewport: viewport })
          .promise.then(function () {
            return canvas.toDataURL('image/jpeg', 0.7);
          });
      });
  }

  // 画像ファイル → 縮小した dataURL。
  function imageFileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = img.width > IMG_MAX_W ? IMG_MAX_W / img.width : 1;
        var cw = Math.round(img.width * scale);
        var ch = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('img'));
      };
      img.src = url;
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

  // 1 ファイル → {name,text} / {name,image,needsVision} / {skip,name}
  function parseFile(file) {
    var e = ext(file.name);
    if (file.size > MAX_BYTES) return Promise.resolve({ skip: 'toobig', name: file.name });
    if (['png', 'jpg', 'jpeg', 'webp'].indexOf(e) !== -1) {
      return imageFileToDataUrl(file)
        .then(function (dataUrl) {
          return { name: file.name, image: dataUrl, needsVision: true };
        })
        .catch(function () {
          return { skip: 'parse', name: file.name };
        });
    }
    if (['xlsx', 'xls', 'csv', 'pdf'].indexOf(e) === -1)
      return Promise.resolve({ skip: 'type', name: file.name });
    return file
      .arrayBuffer()
      .then(function (buf) {
        if (e !== 'pdf') {
          var rows = parseSheet(buf);
          if (!rows || !rows.length) return { skip: 'parse', name: file.name };
          return { name: file.name, text: rowsToText(rows) };
        }
        return parsePdfText(buf).then(function (rows) {
          if (rows && rows.length) return { name: file.name, text: rowsToText(rows) };
          // 文字レイヤー無し（スキャン）→ 先頭ページを画像化して視覚モデルへ（要同意）。
          return pdfFirstPageToImage(buf).then(function (dataUrl) {
            return { name: file.name, image: dataUrl, needsVision: true };
          });
        });
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
          return r && (r.text || r.image);
        });
        lastFiles = ok;
        if (!ok.length) {
          showStatus('parse');
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
      var tag = f.needsVision
        ? ' <span class="o2l-files__img" data-i18n="o2l_file_image"></span>'
        : '';
      html += '<li>' + escapeHtml(f.name || 'file') + tag + '</li>';
    });
    html += '</ul>';
    if (skipped > 0) {
      html +=
        '<p class="o2l-files__skip"><span data-i18n="o2l_files_skipped"></span> ' +
        skipped +
        '</p>';
    }
    fileListEl.innerHTML = html;
    if (window.sdfApplyI18n) window.sdfApplyI18n();
  }

  // ── 画像送信の同意ダイアログ（Promise<boolean>）─────────────────────────────
  function askImageConsent() {
    return new Promise(function (resolve) {
      var modal = document.getElementById('o2lConfirm');
      var ok = document.getElementById('o2lConfirmOk');
      var cancel = document.getElementById('o2lConfirmCancel');
      if (!modal || !ok || !cancel) {
        resolve(false); // ダイアログが無ければ安全側：送信しない
        return;
      }
      function done(v) {
        modal.hidden = true;
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        resolve(v);
      }
      function onOk() {
        done(true);
      }
      function onCancel() {
        done(false);
      }
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      modal.hidden = false;
    });
  }

  // ── AI 整形 ──────────────────────────────────────────────────────────────────
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

  function sendItems(items, truncated) {
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
  }

  if (extractBtn) {
    extractBtn.addEventListener('click', function () {
      if (!lastFiles.length) return;
      if (typeof window.sdfDemoToken !== 'function') {
        showAiStatus('login');
        return;
      }
      var hasVision = lastFiles.some(function (f) {
        return f.needsVision;
      });
      extractBtn.disabled = true;

      var proceed = hasVision ? askImageConsent() : Promise.resolve(true);
      proceed.then(function (consented) {
        // 画像同意しない場合はテキストのファイルだけ処理。テキストが無ければキャンセル。
        var chosen = consented
          ? lastFiles
          : lastFiles.filter(function (f) {
              return !f.needsVision;
            });
        if (!chosen.length) {
          extractBtn.disabled = false;
          showAiStatus('cancelled');
          return;
        }
        var isMember = typeof window.sdfDemoIsMember === 'function' && window.sdfDemoIsMember();
        var cap = isMember ? 10000 : 3000;
        var truncated = false;
        var items = chosen.map(function (f) {
          if (f.needsVision) return { name: f.name, image: f.image };
          if (f.text.length > cap) truncated = true;
          return { name: f.name, text: f.text.slice(0, cap) };
        });
        sendItems(items, truncated);
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

  // 「無料で試す」CTA をデモ欄までスクロール（<base href="../"> のため素の #demo は根に飛ぶ）。
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
