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
//
// 2026-10-24 起新文章的标签是三语对象 {zh, ja, en}（后台三个框＋「一键同步日英」一起翻），
// 上架时缺任何一种语言都会被拦下（js/shared/blog-posts-model.js publishProblem）。
// 起因：英文页上显示了中文标签「思考」，作者要求三语页面不许再出现没翻译的文字。

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
 * @param {string|{zh,ja,en}} tag posts.json 里的值（三语对象，或旧的已知 key／自由文本）
 * @param {(key:string)=>string} [t] 取译文的函数（通常是 window.sdfT）
 * @param {string} [lang] 当前语言（三语对象时用）
 * @returns {string} 当前语言的标签；旧的未知文本原样返回
 */
export function tagLabel(tag, t, lang = 'ja') {
  if (tag && typeof tag === 'object') {
    const pick = (l) => (typeof tag[l] === 'string' ? tag[l].trim() : '');
    return pick(lang) || pick('ja') || pick('zh') || pick('en');
  }
  const raw = typeof tag === 'string' ? tag.trim() : '';
  if (!raw) return '';
  const key = BLOG_TAGS[raw];
  if (!key) return raw; // 自由输入的一次性分类：原样显示
  return typeof t === 'function' ? t(key) : raw;
}

/** 后台编辑用：任何形态的标签 → {zh, ja, en}（旧的单语字符串放进中文框，日英留空待同步）。 */
export function tagObject(tag) {
  if (tag && typeof tag === 'object') {
    const s = (l) => (typeof tag[l] === 'string' ? tag[l] : '');
    return { zh: s('zh'), ja: s('ja'), en: s('en') };
  }
  return { zh: typeof tag === 'string' ? tag : '', ja: '', en: '' };
}

/** 后台下拉用：已知分类的 key 列表（顺序即显示顺序）。 */
export function knownTags() {
  return Object.keys(BLOG_TAGS);
}
