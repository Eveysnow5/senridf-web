// cache-bust 的纯逻辑（无 fs / crypto），供 scripts/qa/cache-bust.mjs 和 sdf-admin Worker 共用（2026-10-22 拆出）。
// Worker 后台发布 blog 文章时，从博客列表页（同样被 npm run bust 维护）读出当前指纹，写进新文章页。
// 以前新文章页的 js/main.js 引用不带 ?v=，上线检查必红，文章上不了线（10-21 实际发生）。

// 共用、且改动会影响页面行为/文案的本地资源。新增共用脚本时加进来。
export const ASSETS = [
  'js/main.js',
  'css/main.css',
  'js/tracking.js',
  'js/order-to-ledger-demo.js',
  'js/lead-form.js',
  'js/shared/blog-content.js',
  'admin/blog/editor.js',
];

// 引用的样子：src="js/main.js" / "../../js/main.js" / "/js/main.js" / 带或不带 ?v=xxx
export function refRegex(asset) {
  const esc = asset.replace(/[.]/g, '\\.');
  return new RegExp(`((?:\\.\\./)*/?${esc})(\\?v=[A-Za-z0-9]+)?(?=["'])`, 'g');
}

/** 把 src 里对各资源的引用改成 want[asset] 的指纹；返回 { out, refs, stale }。 */
export function applyFingerprints(src, want) {
  let refs = 0;
  const stale = [];
  let out = src;
  for (const a of Object.keys(want)) {
    out = out.replace(refRegex(a), (m, base, v) => {
      refs++;
      const good = `?v=${want[a]}`;
      if (v !== good) stale.push(`${base}${v || ''}`);
      return base + good;
    });
  }
  return { out, refs, stale };
}

/** 从一个已被 bust 维护的页面里读出各资源当前的指纹（读不到的资源不出现在结果里）。 */
export function readFingerprints(html, assets = ASSETS) {
  const found = {};
  for (const a of assets) {
    const m = new RegExp(`${a.replace(/[.]/g, '\\.')}\\?v=([A-Za-z0-9]+)(?=["'])`).exec(html);
    if (m) found[a] = m[1];
  }
  return found;
}
