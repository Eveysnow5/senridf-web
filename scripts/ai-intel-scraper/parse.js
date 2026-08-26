// 纯解析：RSS/Atom feed 与官方列表页 → 条目。只依赖 cheerio，可离线单测。
const cheerio = require('cheerio');

// 日期字符串 → ISO 字符串，解析失败返回 null。
function toIso(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// feed 正文（description/summary）清洗：去 HTML 标签、折叠空白、截断 500 字。空则 ''。
// 供判定用——只靠标题+URL 判主题对 METI 短链接/PR TIMES 泛标题误判率高，正文能显著提精度。
function cleanRaw(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

// 按标签名取直接子节点的文本，依次尝试 names，取第一个非空的。
//
// 为什么不用 CSS 选择器：**cheerio 选不了带命名空间前缀的标签**。
// 2026-08-26 实测 css-select 对这类标签一律抛错 —— 转义写法报
// "Unknown pseudo-class"，管道写法报 "Namespaced tag names are not yet supported"。
// 但 xmlMode 下节点的 name 属性保留着完整前缀，所以按 name 过滤子节点能拿到。
function tagText($, el, names) {
  const kids = $(el).children();
  for (const name of names) {
    const hit = kids
      .filter((_, c) => c.name === name)
      .first()
      .text()
      .trim();
    if (hit) return hit;
  }
  return '';
}

// RSS 2.0 用 <pubDate>；RSS 1.0/RDF 用 <dc:date>。
//
// 2026-08-26 真实语料暴露：PR TIMES 发的是 RDF（<rdf:RDF xmlns:dc=...>），
// 200 条里 published_at **全是 null** —— 因为老代码只认 pubDate。
// 565 个测试全绿，而合成夹具恰好写的是 RSS 2.0，所以谁也没发现。
// <date> 放在最后：那是 PR TIMES 自己加的非标准标签，只精确到日，当兜底用。
const DATE_TAGS = ['pubDate', 'dc:date', 'date'];

// 解析 RSS 2.0 / RSS 1.0(RDF) / Atom feed → [{ title, url, published_at, raw }]。
function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  // RSS 2.0 与 RDF: <item><title/><link/><pubDate|dc:date/><description/>
  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const url = $(el).find('link').first().text().trim();
    const pub = tagText($, el, DATE_TAGS);
    const desc = $(el).find('description').first().text();
    if (title && url) items.push({ title, url, published_at: toIso(pub), raw: cleanRaw(desc) });
  });

  // Atom: <entry><title/><link href=.../><updated|published/><summary|content/>
  $('entry').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const href =
      $(el).find('link[rel="alternate"]').attr('href') ||
      $(el).find('link').first().attr('href') ||
      '';
    const pub = tagText($, el, ['updated', 'published', ...DATE_TAGS]);
    const summary = $(el).find('summary').first().text() || $(el).find('content').first().text();
    if (title && href) {
      items.push({ title, url: href.trim(), published_at: toIso(pub), raw: cleanRaw(summary) });
    }
  });

  return items;
}

// 官方列表页：在 linkSelector 范围内取 <a>，相对路径按 base 解析。
// → [{ title, url, published_at: null }]。列表页一般拿不到发布日期，留 null。
function parseListLinks(html, { linkSelector, base }) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  $(linkSelector).each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!title || title.length < 5) return;
    if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('javascript'))
      return;
    const url = href.startsWith('http') ? href : new URL(href, base).toString();
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ title, url, published_at: null });
  });
  return out;
}

module.exports = { parseFeed, parseListLinks, toIso, tagText, DATE_TAGS };
