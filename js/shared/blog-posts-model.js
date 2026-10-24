// Blog 后台的文章列表：把「线上的」和「草稿箱里的」合成一张表，并决定每行哪些按钮能点。
// 纯逻辑，无 IO（tests/blog-drafts.test.mjs）。
//
// 两个来源（2026-10-24 起）：
//   线上   = 仓库里的 solutions/blog/posts.json（公开，谁都能看）
//   草稿箱 = Firestore blog_drafts/p_*（只有管理员能读写；仓库是公开的，草稿不能放那里）
// 「完成」只写草稿箱；「上架」才把草稿箱里的那份发到线上；「下架」从线上撤掉，草稿箱里的留着。

/** 新稿的草稿箱文档 id。前缀 p_ 和自动保存用的 blog_drafts/current 分开。 */
export function newDocId(now = Date.now(), randomFn = Math.random) {
  const rand = Math.floor(randomFn() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `p_${now.toString(36)}${rand}`;
}

/** 只在线上、草稿箱里没有的旧文章，第一次编辑/下架时按 slug 建档。 */
export const docIdForSlug = (slug) => `p_${slug}`;

/**
 * @param {Array} livePosts  posts.json 的条目（slug, date, tag, title, body, cover）
 * @param {Array} savedDocs  草稿箱文档（id, slug?, date, tag, title, body, cover?, dirty?）
 * @returns 行数组，按日期新→旧。key 用于按钮回调：草稿箱有档就是文档 id，否则 `live:<slug>`。
 */
export function mergeRows(livePosts, savedDocs) {
  const liveBySlug = new Map(livePosts.map((p) => [p.slug, p]));
  const claimed = new Set();
  const rows = [];
  for (const d of savedDocs) {
    const live = Boolean(d.slug && liveBySlug.has(d.slug) && !claimed.has(d.slug));
    if (live) claimed.add(d.slug);
    rows.push({
      key: d.id,
      docId: d.id,
      slug: d.slug || null,
      date: d.date || '',
      title: (d.title && d.title.zh) || '',
      live,
      // 线上那份之后在草稿箱里改过、还没重新上架
      dirty: live && Boolean(d.dirty),
    });
  }
  for (const p of livePosts) {
    if (claimed.has(p.slug)) continue;
    rows.push({
      key: `live:${p.slug}`,
      docId: null,
      slug: p.slug,
      date: p.date,
      title: (p.title && p.title.zh) || '',
      live: true,
      dirty: false,
    });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

/** 草稿（从没上过、或已下架）和「线上有未上架修改」的能上架；在线上的能下架。 */
export function rowActions(row) {
  return { canPublish: !row.live || row.dirty, canUnpublish: row.live };
}

export function rowStatus(row) {
  if (!row.live) return { text: '草稿', cls: 'draft' };
  if (row.dirty) return { text: '已上架 · 有修改未上架', cls: 'dirty' };
  return { text: '已上架', cls: 'live' };
}

/**
 * 上架前预览：Worker /blog/preview 返回的就是上架时要写进仓库的那份文章页（同一个 buildArticle）。
 * 放进弹窗的 iframe 只改两处，其余一字不动：
 *   ① <base href="../../"> → "/"：文章在 /solutions/blog/ 下，../../ 就是站点根；弹窗里没有这个目录层级
 *   ② 去掉访问统计脚本：预览不能算一次访问
 * 模板哪天改了、这两处找不到，就报错不显示——宁可没预览，也不给一个和线上不一样的预览。
 */
export function previewDoc(html) {
  const BASE = '<base href="../../">';
  if (!html.includes(BASE)) throw new Error('文章页模板变了（找不到 base），预览不出来');
  const TRACKING = /\n?[ \t]*<script type="module" src="js\/tracking\.js[^"]*"><\/script>/;
  if (!TRACKING.test(html)) throw new Error('文章页模板变了（找不到统计脚本），预览不出来');
  return html.replace(BASE, '<base href="/">').replace(TRACKING, '');
}

/** 上架前的检查：三语标题正文齐全、日期完整且不在未来。返回错误文字，没问题返回空串。 */
export function publishProblem(post, today) {
  const empty = ['zh', 'ja', 'en'].filter(
    (l) => !(post.title && String(post.title[l] || '').trim()) || !(post.body && post.body[l]),
  );
  if (empty.length) return `${empty.join('・')} 的标题或正文是空的（编辑后可点「一键同步日英」）`;
  // 首页摘要可以不填（首页从正文自动取）；填了就必须三语都有，否则别的语言首页显示的是另一种语言
  const ex = post.excerpt;
  if (ex && typeof ex === 'object') {
    const has = (l) => typeof ex[l] === 'string' && ex[l].trim();
    const filled = ['zh', 'ja', 'en'].filter(has);
    if (filled.length && filled.length < 3) {
      const miss = ['zh', 'ja', 'en'].filter((l) => !has(l));
      return `首页摘要缺 ${miss.join('・')}（编辑后可点「一键同步日英」，或把摘要全部清空改用自动摘要）`;
    }
  }
  // 标签可以不填；填了就必须三语都有（2026-10-24：英文页出现过中文标签）
  const tag = post.tag;
  if (typeof tag === 'string' && tag.trim()) {
    return '标签只有一种语言（旧格式）：请编辑这篇，补上日・英标签（或点「一键同步日英」）后再上架';
  }
  if (tag && typeof tag === 'object') {
    const has = (l) => typeof tag[l] === 'string' && tag[l].trim();
    const filled = ['zh', 'ja', 'en'].filter(has);
    if (filled.length && filled.length < 3) {
      const miss = ['zh', 'ja', 'en'].filter((l) => !has(l));
      return `标签缺 ${miss.join('・')}（编辑后可点「一键同步日英」）`;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date || '')) return '发布日期没填完整';
  if (post.date > today) return '发布日期在未来（上架会马上公开，不是定时发布）';
  return '';
}

// ── 刚上传、网站还没构建完的博客图片（2026-10-24）──
// 图片经 Worker 写进仓库后，要等网站重新构建（几分钟）才能用 /assets/... 访问；这段时间里
// 后台编辑区和上架预览改用 Worker 直接取的原图（data: URL）。正文里存的永远是 /assets/... 路径。
const BLOG_IMG = /\/(assets\/images\/blog\/[A-Za-z0-9-]+\.webp)/g;

/** img 的 src 是不是博客图片；是就返回仓库内路径（assets/images/blog/…），否则 null。 */
export function blogImagePathOf(src) {
  const m = /^(?:https?:\/\/[^/]+)?\/(assets\/images\/blog\/[A-Za-z0-9-]+\.webp)$/.exec(
    String(src || ''),
  );
  return m ? m[1] : null;
}

/** HTML（含文章页里的 JSON）中出现的博客图片路径，去重。 */
export function blogImagePaths(html) {
  return [...new Set([...String(html).matchAll(BLOG_IMG)].map((m) => m[1]))];
}

/** 把 map 里有的博客图片路径（/assets/…）换成对应的地址；没有的原样留着。 */
export function replaceBlogImages(html, map) {
  return String(html).replace(BLOG_IMG, (m, path) => map[path] || m);
}
