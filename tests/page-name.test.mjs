import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageName, visitSource } from '../js/shared/page-name.js';

// 期待值照着网站真实网址手写（sitemap.xml + 工具页 + Worker 生成的文章页形状）。
// 2026-10-22 之前博客被算成 solutions、受発注 LP 也并在 solutions 里——前两条守的就是这个。

test('博客（列表与文章）不再被 /solutions 吞掉', () => {
  assert.equal(pageName('/solutions/blog/'), 'blog');
  assert.equal(pageName('/solutions/blog/index.html'), 'blog');
  assert.equal(pageName('/solutions/blog/2026-10-21-a1b2'), 'blog');
});

test('受発注 LP 单独成类（有无 .html 都认）', () => {
  assert.equal(pageName('/solutions/order-to-ledger'), 'order-to-ledger');
  assert.equal(pageName('/solutions/order-to-ledger.html'), 'order-to-ledger');
});

test('其余公开页与工具页的归类', () => {
  const cases = {
    '/': 'home',
    '/index.html': 'home',
    '/about/': 'about',
    '/about/milestones': 'about',
    '/about/company': 'about',
    '/solutions/': 'solutions',
    '/solutions/demo': 'demo-index',
    '/solutions/demo/': 'demo-index',
    '/solutions/demo/japanese_learner': 'japanese_learner',
    '/solutions/demo/analysis.html': 'analysis',
    '/solutions/demo/lifestory': 'lifestory',
    '/solutions/demo/translation': 'translation',
    '/contact': 'contact',
    '/privacy/': 'home',
  };
  for (const [p, want] of Object.entries(cases)) assert.equal(pageName(p), want, p);
});

test('sitemap 里每个网址都有归类，且只有首页和隐私页落到 home', () => {
  const locs = [...readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname,
  );
  assert.ok(locs.length >= 8, `sitemap 只读到 ${locs.length} 条`);
  const home = locs.filter((p) => pageName(p) === 'home').sort();
  assert.deepEqual(home, ['/', '/privacy/']);
});

test('来源：外站只留主机名，去掉 www.，不留路径和查询串', () => {
  assert.equal(
    visitSource('https://www.google.com/search?q=注文書+台帳', '', 'www.senridf.com'),
    'google.com',
  );
  assert.equal(visitSource('https://t.co/abc', '', 'www.senridf.com'), 't.co');
});

test('来源：站内跳转与直接打开都是 null（不写字段，免得覆盖当天先记下的来源）', () => {
  assert.equal(visitSource('https://www.senridf.com/about/', '', 'www.senridf.com'), null);
  assert.equal(visitSource('https://senridf.com/', '', 'www.senridf.com'), null, '裸域也是自己');
  assert.equal(visitSource('', '', 'www.senridf.com'), null);
  assert.equal(visitSource(undefined, '', 'www.senridf.com'), null);
});

test('来源：utm_source 优先于 referrer，统一小写', () => {
  assert.equal(
    visitSource(
      'https://www.google.com/',
      '?utm_source=Yorozu&utm_medium=flyer',
      'www.senridf.com',
    ),
    'utm:yorozu',
  );
  assert.equal(visitSource('', '?utm_source=', 'www.senridf.com'), null, '空的 utm 不算');
});

test('tracking.js 用的是这个模块，没有留一份本地判断', () => {
  const s = readFileSync('js/tracking.js', 'utf8');
  assert.match(s, /from '\/js\/shared\/page-name\.js(?:\?v=[0-9a-f]{10})?'/);
  assert.doesNotMatch(s, /function getPageName/);
  assert.match(s, /refSource: visitSource\(/);
});
