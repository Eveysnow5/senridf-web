/* 相談フォーム（共通）：<form data-lead-form data-lead-source="…"> をすべて配線する。
   送信は tracking.js の window.sdfSubmitLead（匿名セッションで Firestore leads へ直書き）。
   source は管理画面のリード一覧に出る「どこから来た相談か」（例：contact / order-to-ledger）。
   2026-10-07：受発注ページ専用だった処理を、汎用の /contact.html と共用するため切り出した。 */
(function () {
  'use strict';

  function toggleMsgs(host, key) {
    if (!host) return;
    var msgs = host.querySelectorAll('[data-msg]');
    for (var i = 0; i < msgs.length; i++) {
      msgs[i].hidden = msgs[i].getAttribute('data-msg') !== key;
    }
    host.hidden = !key;
  }

  function wire(form) {
    var status = form.querySelector('[data-lead-status]');
    var submit = form.querySelector('button[type="submit"]');
    var source = form.getAttribute('data-lead-source') || 'unknown';
    function show(key) {
      toggleMsgs(status, key);
    }
    function val(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? (el.value || '').trim() : '';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // ハニーポット：人間には見えない欄。埋まっていたらボット扱いし、成功を装って何も送らない。
      if (val('website')) {
        show('ok');
        return;
      }
      var name = val('name');
      var email = val('email');
      var message = val('message');
      // クライアント側の最低限チェック。本検証は firestore.rules が強制。
      if (!name || !message || !/.+@.+\..+/.test(email)) {
        show('invalid');
        return;
      }
      if (typeof window.sdfSubmitLead !== 'function') {
        show('error');
        return;
      }
      if (submit) submit.disabled = true;
      show('sending');
      window
        .sdfSubmitLead({
          name: name,
          company: val('company'),
          email: email,
          message: message,
          lang: (document.documentElement.lang || 'ja').slice(0, 8),
          source: source,
        })
        .then(function () {
          show('ok');
          form.reset();
        })
        .catch(function (err) {
          console.error('[lead-form] 相談送信失敗:', err);
          show('error');
        })
        .then(function () {
          if (submit) submit.disabled = false;
        });
    });
  }

  var forms = document.querySelectorAll('form[data-lead-form]');
  for (var i = 0; i < forms.length; i++) wire(forms[i]);
})();
