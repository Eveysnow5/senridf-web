/* 受発注ランディングのデモ（バッチ + 画像OCR対応）：
   - 文字PDF/Excel/CSV：ブラウザ内で解析。AI整形を押したときだけ、読み取った文字を送る
     （原本ファイルは非送信）。送り先 AI の名称は送信前に表示する（loadAiRoute）。
   - スキャンPDF/画像：文字レイヤーが無いので、画像を視覚モデルに送って読み取る。
     ⚠️ 画像は当社サーバー経由で AI に送信されるため、送信前に**確認ダイアログ**で同意を取る。
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
  var checksEl = document.getElementById('o2lChecks');
  // 要約の「小計／合計」は翻訳済みの語を引数で埋めているので、data-i18n の再翻訳では変わらない。
  // 言語切替（main.js が <html lang> を書き換える）を見て要約だけ描き直す。
  // renderChecks は sdfSetText しか使わない（applyTranslations を呼ばない）ので、ここから再帰はしない。
  if (checksEl && typeof MutationObserver === 'function') {
    new MutationObserver(function () {
      if (lastMerged && lastMerged.checks) renderChecks(lastMerged.rows, lastMerged.checks);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

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

  // 同じ行の文字片を、実際の見た目の隙間（字の大きさ＝em 単位）で繋ぐ：
  //   ≤0.15em → そのまま連結（PDF 内で分割されただけの語。例：コピー|用|紙）
  //   ≤0.6em  → 空白（セル内の語の区切り。通常の空白字形は 0.25〜0.35em）
  //   >0.6em  → タブ（列の区切り）。Excel/CSV 経路もセルをタブで送るので形式がそろう。
  // 以前は常に ' ' で繋いでいたため、語が「コピー 用 紙」と割れ、列の境目も消えて
  // 「500枚 20 箱」の数量/単位を取り違えた（2026-10-06、Gemma で発覚）。
  // 空白だけの文字片は位置計算に使わない：Edge/Chrome の PDF はセル間に空白片を置き、
  // その幅が列の隙間全体に伸びているため、測ると隙間が負になる。
  function joinLine(items) {
    items.sort(function (a, b) {
      return a.transform[4] - b.transform[4];
    });
    var text = '';
    var prevEnd = null;
    items.forEach(function (it) {
      if (!it.str.trim()) return;
      var x = it.transform[4];
      var size = Math.abs(it.transform[0]) || it.height || 10;
      if (prevEnd !== null) {
        var gap = (x - prevEnd) / size;
        text += gap > 0.6 ? '\t' : gap > 0.15 ? ' ' : '';
      }
      text += it.str;
      prevEnd = x + (it.width || 0);
    });
    return text.trim();
  }

  // cMapUrl：フォントを埋め込まない日本語 PDF（UniJIS-UTF16-H 等の定義済みエンコーディング）は、
  // pdf.js が別途エンコーディング表を読まないと文字を復元できない。無いと**エラーを出さずに字が落ちる**：
  // TKC の残高試算表は 0 字になり「スキャン画像」と誤判定されていた（2026-10-23、本番ページで確認）。
  // closing.html の PDF_OPTS と同じ設定。cdnjs には cmaps が無い（403）ので jsDelivr の同じ版を読む。
  // isEvalSupported:false は CVE-2024-4367 の緩和。
  var PDF_OPTS = {
    isEvalSupported: false,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
  };

  function parsePdfText(buf) {
    if (typeof pdfjsLib === 'undefined') return Promise.reject(new Error('pdf.js'));
    return pdfjsLib
      .getDocument(Object.assign({ data: buf.slice(0) }, PDF_OPTS))
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
                (lines[y] = lines[y] || []).push(it);
              });
              Object.keys(lines)
                .sort(function (a, b) {
                  return b - a;
                })
                .forEach(function (y) {
                  var text = joinLine(lines[y]);
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
      .getDocument(Object.assign({ data: buf.slice(0) }, PDF_OPTS))
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
        loadAiRoute();
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

  // ── 送り先の開示（送信前）──────────────────────────────────────────────────────
  // 端点の GET が「今実際に使う AI」の名称を返す（専用鍵の有無で変わるため、ページに
  // 固定で書くと経路とずれる）。取れなければ名称は出さず、汎用の注記だけ残す。
  var aiRouteEl = document.getElementById('o2lAiRoute');
  var aiRouteNameEl = document.getElementById('o2lAiRouteName');
  var aiRouteLoaded = false;
  function showAiRoute(name) {
    if (!aiRouteEl || !aiRouteNameEl || !name) return;
    aiRouteNameEl.textContent = String(name);
    aiRouteEl.hidden = false;
  }
  function loadAiRoute() {
    if (aiRouteLoaded || typeof window.sdfDemoToken !== 'function') return;
    aiRouteLoaded = true;
    Promise.resolve(window.sdfDemoToken())
      .then(function (token) {
        if (!token) throw new Error('no token');
        return fetch('/api/demo-order-extract', {
          headers: { Authorization: 'Bearer ' + token },
        });
      })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (b) {
        if (b && b.ai) showAiRoute(b.ai);
        else aiRouteLoaded = false; // 次の読み取り時に再試行
      })
      .catch(function () {
        aiRouteLoaded = false;
      });
  }

  // ── AI 整形 ──────────────────────────────────────────────────────────────────
  function resetAi() {
    if (ledgerEl) ledgerEl.hidden = true;
    lastMerged = null;
    if (checksEl) {
      checksEl.innerHTML = '';
      checksEl.hidden = true;
    }
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

  // checks：サーバの自動チェック結果（functions/api/_lib/ledgerChecks.js）。
  //   rows[i] ＝ i 行目の問題コード配列、files ＝ ファイルごとの合計照合。
  // 問題のある行は色を付け、末尾の「確認」列に理由を出す。文言は data-i18n（言語切替に追従）。
  function rowIssues(checks, i) {
    return (checks && checks.rows && checks.rows[i]) || [];
  }

  function renderMerged(columns, rows, checks) {
    // 「確認」列は画面では先頭に置く（表は横に長く、末尾だと横スクロールしないと見えない）。
    // ダウンロードする Excel では末尾（台帳の列順を崩さない）。
    var html = '<table class="o2l-table"><thead><tr>';
    if (checks) html += '<th data-i18n="o2l_chk_col"></th>';
    columns.forEach(function (c) {
      html += '<th>' + escapeHtml(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.slice(0, MAX_ROWS_SHOWN).forEach(function (row, i) {
      var issues = rowIssues(checks, i);
      html += issues.length ? '<tr class="o2l-row--warn">' : '<tr>';
      if (checks) {
        html +=
          '<td class="o2l-chk-cell">' +
          issues
            .map(function (code) {
              return '<span data-i18n="o2l_chk_' + escapeHtml(code) + '"></span>';
            })
            .join('<br>') +
          '</td>';
      }
      columns.forEach(function (c) {
        html += '<td>' + escapeHtml(row[c] != null ? String(row[c]) : '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    ledgerWrap.innerHTML = html;
    renderChecks(rows, checks);
    if (typeof window.sdfApplyI18n === 'function') window.sdfApplyI18n();
  }

  // 表の上の要約：要確認の行数 ＋ ファイルごとの合計照合。照合していないものは「していない」と書く。
  function renderChecks(rows, checks) {
    if (!checksEl) return;
    checksEl.innerHTML = '';
    if (!checks) {
      checksEl.hidden = true;
      return;
    }
    var bad = (checks.rows || []).filter(function (c) {
      return c && c.length;
    }).length;
    var yen = function (v) {
      return Number(v).toLocaleString('ja-JP');
    };
    var lines = [];
    lines.push(
      bad
        ? { key: 'o2l_chk_rows_ng', arg: { bad: bad }, warn: true }
        : { key: 'o2l_chk_rows_ok', arg: { n: rows.length } },
    );
    (checks.files || []).forEach(function (f) {
      var basis = f.basis && window.sdfT ? window.sdfT('o2l_chk_basis_' + f.basis) : '';
      var arg = { file: f.file, sum: yen(f.sum), printed: yen(f.printed), basis: basis };
      if (f.status === 'ok') lines.push({ key: 'o2l_chk_total_ok', arg: arg });
      else if (f.status === 'mismatch')
        lines.push({ key: 'o2l_chk_total_ng', arg: arg, warn: true });
      else if (f.status === 'no_total') lines.push({ key: 'o2l_chk_total_none', arg: arg });
      else if (f.status === 'partial') lines.push({ key: 'o2l_chk_total_partial', arg: arg });
      // no_amount（金額の無い注文書）は照合の対象外なので何も書かない
    });
    lines.forEach(function (l) {
      var p = document.createElement('p');
      p.className = l.warn ? 'o2l-checks__line o2l-checks__line--warn' : 'o2l-checks__line';
      if (typeof window.sdfSetText === 'function') window.sdfSetText(p, l.key, l.arg);
      checksEl.appendChild(p);
    });
    checksEl.hidden = false;
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
        if (r.body && r.body.ai) showAiRoute(r.body.ai); // 実際に使った AI で上書き
        // 専用付費キーが無い間、画像は「準備中」としてサーバ側で外される（回数は消費しない）。
        var visionPending = (r.body && r.body.visionPending) || 0;
        if (!rows.length) {
          showAiStatus(visionPending ? 'vision_pending' : 'error');
          return;
        }
        var checks = (r.body && r.body.checks) || null;
        lastMerged = { columns: columns, rows: rows, checks: checks };
        renderMerged(columns, rows, checks);
        if (ledgerEl) ledgerEl.hidden = false;
        showAiStatus(visionPending ? 'vision_pending' : truncated ? 'toobig' : null);
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
      var checks = lastMerged.checks;
      var t =
        window.sdfT ||
        function (k) {
          return k;
        };
      // 自動チェックの結果も「確認」列として残す（列名は他の列と同じく日本語固定、理由は画面の言語）
      var aoa = [checks ? cols.concat(['確認']) : cols.slice()];
      lastMerged.rows.forEach(function (row, i) {
        var line = cols.map(function (c) {
          return row[c] != null ? row[c] : '';
        });
        if (checks) {
          line.push(
            rowIssues(checks, i)
              .map(function (code) {
                return t('o2l_chk_' + code);
              })
              .join(' / '),
          );
        }
        aoa.push(line);
      });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '台帳');
      XLSX.writeFile(wb, 'daicho.xlsx');
    });
  }

  // ── サンプル注文書で試す ─────────────────────────────────────────────────────
  // 静的な PDF を取ってきて、ユーザーが選んだファイルと同じ経路（ブラウザ内読み取り）に流す。
  // 特別扱いはしない＝サンプルで動けば実ファイルでも同じ経路が動いている証拠になる。
  var sampleBtn = document.getElementById('o2lSample');
  if (sampleBtn) {
    sampleBtn.addEventListener('click', function () {
      sampleBtn.disabled = true;
      fetch('/solutions/samples/sample-order.pdf')
        .then(function (res) {
          if (!res.ok) throw new Error('sample ' + res.status);
          return res.blob();
        })
        .then(function (blob) {
          handleFiles([new File([blob], 'sample-order.pdf', { type: 'application/pdf' })]);
        })
        .catch(function (err) {
          console.error('[order-to-ledger] サンプル取得失敗:', err);
          showStatus('parse');
        })
        .then(function () {
          sampleBtn.disabled = false;
        });
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

  // ── 相談欄へのスクロール（Stage D）─────────────────────────────────────────────
  // 「無料で相談する」CTA を相談欄へスクロール（#demo と同じく base href 対策で JS）。
  var consultSection = document.getElementById('consult');
  var toConsultLinks = document.querySelectorAll('a[href="#consult"]');
  for (var c = 0; c < toConsultLinks.length; c++) {
    toConsultLinks[c].addEventListener('click', function (e) {
      if (!consultSection) return;
      e.preventDefault();
      consultSection.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // 送信処理は js/lead-form.js（/contact.html と共用）。
})();
