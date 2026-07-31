// 纯解析：RSS/Atom feed 与官方列表页 → 条目。只依赖 cheerio，可离线单测。
const cheerio = require('cheerio');

// 日期字符串 → ISO 字符串，解析失败返回 null。
function toIso(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// 解析 RSS 2.0 或 Atom feed → [{ title, url, published_at }]。
function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  // RSS 2.0: <item><title/><link/><pubDate/>
  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const url = $(el).find('link').first().text().trim();
    const pub = $(el).find('pubDate').first().text().trim();
    if (title && url) items.push({ title, url, published_at: toIso(pub) });
  });

  // Atom: <entry><title/><link href=.../><updated|published/>
  $('entry').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const href =
      $(el).find('link[rel="alternate"]').attr('href') ||
      $(el).find('link').first().attr('href') ||
      '';
    const pub =
      $(el).find('updated').first().text().trim() || $(el).find('published').first().text().trim();
    if (title && href) items.push({ title, url: href.trim(), published_at: toIso(pub) });
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

module.exports = { parseFeed, parseListLinks, toIso };
