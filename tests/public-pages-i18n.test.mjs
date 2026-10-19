import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 公开页面（sitemap.xml 里的每一页）的两条底线（2026-10-19）：
//
// ① 看得见的中日文字必须走三语（元素自身或祖先带 data-i18n），属性文字（placeholder/title/aria-label/alt）
//    要有对应的 data-i18n-placeholder / -title / -alt。2026-10-07 未经审查上线的 /contact 与
//    /solutions/automation 整页写死日文，切中/英仍是日文，i18n-keys 测试全绿——因为它只查 T 里的键，
//    不看页面上有没有绕过 T 的字。仓库 CLAUDE.md 写着「never hardcode strings in HTML」，照样被违反：
//    规则只写在文字里、没有检查，挡不住另一台机器上的会话。
//    故意不翻译的（示例原文、人名缩写）在元素上标 translate="no"——这也是 HTML 本来的语义。
//
// ② 收邮箱的表单必须接到提交（data-lead-form + js/lead-form.js）。同一次覆盖把 /contact 的表单换成了
//    没有任何去处的模板，点「送信」只刷新本页，11 天的咨询全丢，任何检查都没红。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');

/** sitemap 的 URL → 仓库里的文件 */
function pageFiles() {
  return [...SITEMAP.matchAll(/<loc>https:\/\/www\.senridf\.com\/([^<]*)<\/loc>/g)].map((m) => {
    const p = m[1];
    if (p === '' || p.endsWith('/')) return p + 'index.html';
    return p.endsWith('.html') ? p : p + '.html';
  });
}

const CJK = /[ぁ-ゖァ-ヺ一-鿿]/;
// 允许原样出现的专有名词：品牌、公司全称、成员姓名
const PROPER = /千里同風|千里同风|株式会社|南\s?雪|謝\s?怡然/g;
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const ATTR_KEYS = {
  placeholder: 'data-i18n-placeholder',
  title: 'data-i18n-title',
  'aria-label': 'data-i18n-aria-label',
  alt: 'data-i18n-alt',
};

function parseAttrs(s) {
  const a = {};
  for (const m of s.matchAll(/([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    a[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return a;
}

/** 扫 <body>：返回绕过 i18n 的可见文字与属性文字 */
function hardcoded(html) {
  const body = html.slice(html.indexOf('<body'));
  const clean = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, '');
  const out = [];
  const stack = []; // { tag, covered }
  const covered = () => stack.length > 0 && stack[stack.length - 1].covered;
  for (const m of clean.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (m[5] !== undefined) {
      const t = m[5].replace(/\s+/g, ' ').trim();
      if (t && CJK.test(t.replace(PROPER, '')) && !covered()) out.push(`文字「${t.slice(0, 40)}」`);
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = stack.map((x) => x.tag).lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      continue;
    }
    const attrs = parseAttrs(m[3]);
    const cov = covered() || 'data-i18n' in attrs || attrs.translate === 'no';
    for (const [a, k] of Object.entries(ATTR_KEYS)) {
      const v = attrs[a];
      if (
        v &&
        CJK.test(v.replace(PROPER, '')) &&
        !(k in attrs) &&
        !cov &&
        attrs.translate !== 'no'
      ) {
        out.push(`<${tag} ${a}="${v.slice(0, 30)}">`);
      }
    }
    if (!VOID.has(tag) && !m[4]) stack.push({ tag, covered: cov });
  }
  return out;
}

const PAGES = pageFiles();

test('护栏自身有效：sitemap 里抽到了足量页面，且文件都存在', () => {
  assert.ok(PAGES.length >= 8, `只抽到 ${PAGES.length} 页`);
  for (const p of PAGES) assert.ok(readFileSync(path.join(ROOT, p), 'utf8').length > 0, p);
});

test('护栏自身有效：写死的日文、写死的 placeholder 会被抓到；带 data-i18n 或 translate="no" 的放过', () => {
  // 2026-10-07 /contact 被覆盖后的真实形状
  const bad =
    '<body><h1>お問い合わせ</h1><textarea placeholder="ご質問内容をお書きください"></textarea></body>';
  assert.equal(hardcoded(bad).length, 2);
  const ok =
    '<body><h1 data-i18n="contact_title">無料相談</h1><p translate="no"><span>株式会社サンプル商事</span></p>' +
    '<input placeholder="例" data-i18n-placeholder="x"><h2>千里同風</h2><br><p data-i18n="a">x<b>太字</b></p></body>';
  assert.deepEqual(hardcoded(ok), []);
});

test('★ 公开页面上看得见的中日文字都走三语（没有写死、切语言不变的字）', () => {
  const found = [];
  for (const p of PAGES) {
    for (const h of hardcoded(readFileSync(path.join(ROOT, p), 'utf8'))) found.push(`${p}: ${h}`);
  }
  assert.deepEqual(found, [], `发现 ${found.length} 处写死的文字：\n  ${found.join('\n  ')}`);
});

test('★ 公开页面里收邮箱的表单都接到了提交（data-lead-form + lead-form.js）', () => {
  const bad = [];
  let forms = 0;
  for (const p of PAGES) {
    const html = readFileSync(path.join(ROOT, p), 'utf8');
    for (const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
      if (!/name=["']email["']/.test(m[2])) continue;
      forms++;
      if (!/\bdata-lead-form\b/.test(m[1]) || !/data-lead-source=["'][\w-]+["']/.test(m[1])) {
        bad.push(`${p}: 表单没有 data-lead-form / data-lead-source`);
      }
      if (!/<script[^>]+src=["'][^"']*js\/lead-form\.js/.test(html))
        bad.push(`${p}: 没有加载 js/lead-form.js`);
      if (!/<script[^>]+src=["'][^"']*js\/tracking\.js/.test(html)) {
        bad.push(`${p}: 没有加载 js/tracking.js（sdfSubmitLead 在里面）`);
      }
    }
  }
  assert.ok(
    forms >= 2,
    `只找到 ${forms} 个收邮箱的表单——/contact 与受発注页至少各一个，护栏失去对象`,
  );
  assert.deepEqual(bad, [], bad.join('\n'));
});
