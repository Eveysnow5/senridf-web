import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { scan, PUBLIC, ORIGIN, htmlFiles } from '../scripts/qa/head-meta.mjs';

// 2026-10-06 体检：favicon 404、无 og:image、子页面无 og:title、无 canonical。
// head 信息由 scripts/qa/head-meta.mjs 生成；改了 <title>/description 或新增页面却没重跑，这里变红。
test('所有页面的 head 信息与生成器一致（改了标题/描述或新增页面要 npm run meta）', () => {
  assert.deepEqual(scan({ write: false }), []);
});

test('公开页面都有 canonical、og:title、og:description、og:image 和图标', () => {
  for (const f of Object.keys(PUBLIC)) {
    if (!existsSync(f)) continue; // 表里预先登记、尚未创建的页面
    const s = readFileSync(f, 'utf8');
    assert.match(
      s,
      /<link rel="canonical" href="https:\/\/www\.senridf\.com\//,
      `${f} 缺 canonical`,
    );
    assert.match(s, /<meta property="og:title" content="[^"]+"/, `${f} 缺 og:title`);
    assert.match(
      s,
      /<meta property="og:description" content="[^"]{20,}"/,
      `${f} 缺 og:description`,
    );
    assert.ok(
      s.includes(`<meta property="og:image" content="${ORIGIN}/og-image.png">`),
      `${f} 缺 og:image`,
    );
    assert.match(s, /<link rel="icon" href="\/favicon\.ico"/, `${f} 缺图标`);
  }
});

test('图标与分享卡片文件存在；公开页面表与 sitemap 一致', () => {
  for (const f of ['favicon.ico', 'apple-touch-icon.png', 'og-image.png'])
    assert.ok(existsSync(f), `${f} 不存在`);
  const sm = readFileSync('sitemap.xml', 'utf8');
  for (const [f, route] of Object.entries(PUBLIC)) {
    if (!existsSync(f)) continue;
    assert.ok(sm.includes(`<loc>${ORIGIN}${route}</loc>`), `${f}（${route}）不在 sitemap.xml 里`);
  }
});

test('护栏自身有效：扫到了足够多的页面', () => {
  assert.ok(htmlFiles().length >= 10);
});
