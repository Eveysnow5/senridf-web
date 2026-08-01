const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFeed, parseListLinks, toIso } = require('../scripts/ai-intel-scraper/parse');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('parseFeed：解析 RSS 2.0 的 item（标题/链接/日期）', () => {
  const items = parseFeed(fixture('ai-intel-rss.xml'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '介護ロボット新製品を発表');
  assert.equal(items[0].url, 'https://example.com/news/1');
  assert.match(items[0].published_at, /^2026-07-27T/);
  assert.match(items[0].raw, /見守りロボット/);
  assert.equal(items[1].raw, '');
});

test('parseFeed：解析 Atom 的 entry（link href / updated）', () => {
  const items = parseFeed(fixture('ai-intel-atom.xml'));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'AI規制ガイドライン改訂');
  assert.equal(items[0].url, 'https://example.org/a/10');
  assert.equal(items[0].published_at, '2026-07-29T08:00:00.000Z');
  assert.match(items[0].raw, /ガイドライン/);
});

test('toIso：坏日期返回 null', () => {
  assert.equal(toIso('不是日期'), null);
  assert.equal(toIso(''), null);
});

test('parseListLinks：容器内取链接、解析相对路径、跳过锚点/导航', () => {
  const items = parseListLinks(fixture('ai-intel-list.html'), {
    linkSelector: '#main a',
    base: 'https://www.meti.go.jp/press/',
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://www.meti.go.jp/press/2026/07/20260728.html');
  assert.equal(items[1].url, 'https://www.meti.go.jp/press/abs.html');
  assert.equal(items[0].published_at, null);
  assert.equal(items[0].raw, undefined);
});
