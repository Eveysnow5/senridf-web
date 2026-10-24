// 文章页模板（workers/sdf-admin/src/blog.js renderArticleHtml）改了以后，把已经上线的文章页按新模板重新生成。
// 用和后台上架同一个 buildArticle、同一份列表页指纹，所以生成结果就是「现在重新上架一次」会写出的页面。
// 用法：先 npm run bust（更新指纹），再 node scripts/blog/rerender-articles.mjs
// 2026-10-24 起有：标题自适应（fitTitle）要进旧文章页。
import { readFileSync, writeFileSync } from 'node:fs';
import { buildArticle, LISTING_PATH } from '../../workers/sdf-admin/src/blog.js';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const posts = JSON.parse(read('solutions/blog/posts.json'));
const listing = read(LISTING_PATH);

let changed = 0;
for (const p of posts) {
  const file = `solutions/blog/${p.slug}.html`;
  const { html } = buildArticle(
    { date: p.date, tag: p.tag, title: p.title, body: p.body },
    { slug: p.slug, posts, listing },
  );
  let old = '';
  try {
    old = read(file).replace(/\r\n/g, '\n');
  } catch {
    // 文件不存在：照样写出
  }
  if (old !== html) {
    writeFileSync(new URL(file, ROOT), html);
    changed++;
    console.log('重新生成', file);
  }
}
console.log(`共 ${posts.length} 篇，改了 ${changed} 篇`);
