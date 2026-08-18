// 博客分类的三语标签。
//
// 修的是什么：`posts.json` 里 `tag` 原本是后台自由输入的**一个字符串**，
// 博客列表直接把它渲染出来——于是日文页和英文页都显示中文（或日文）分类，
// 而 title/body 明明已经是三语对象了。
//
// 为什么用固定映射表而不是"每篇也翻译一遍"：分类通常就那么几个，
// 逐篇翻译既费额度又会漂移（同一个分类在不同文章里被译成不同说法）。
// 映射表是 O(分类数) 的一次性成本，且改一处全站生效。
//
// ⚠️ 保留自由输入的回退：不在表里的值**原样显示**。
//    一次性的分类不该逼作者先改代码才能发文；代价是那种分类不翻译，
//    这是有意识的取舍，不是遗漏。

/** 已知分类：key → i18n 键。key 就是写进 posts.json 的值。 */
export const BLOG_TAGS = {
  ai_hardware: 'blog_tag_ai_hardware',
  research: 'blog_tag_research',
  product: 'blog_tag_product',
  news: 'blog_tag_news',
  tech: 'blog_tag_tech',
};

/**
 * 取分类的显示文案。
 * @param {string} tag posts.json 里的值（已知 key 或自由文本）
 * @param {(key:string)=>string} [t] 取译文的函数（通常是 window.sdfT）
 * @returns {string} 已知分类→当前语言的标签；未知→原样返回
 */
export function tagLabel(tag, t) {
  const raw = typeof tag === 'string' ? tag.trim() : '';
  if (!raw) return '';
  const key = BLOG_TAGS[raw];
  if (!key) return raw; // 自由输入的一次性分类：原样显示
  return typeof t === 'function' ? t(key) : raw;
}

/** 后台下拉用：已知分类的 key 列表（顺序即显示顺序）。 */
export function knownTags() {
  return Object.keys(BLOG_TAGS);
}
